import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CdpClient } from '@coinbase/cdp-sdk';
import crypto from 'crypto';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

// Initialize CDP client for server wallet
const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
});

const SERVER_WALLET_ADDRESS = process.env.CDP_SERVER_WALLET_ADDRESS || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

/**
 * Daily verification cron job
 * Runs every 24 hours to:
 * 1. Take screenshot of X profile
 * 2. Check if ad image is still there (image hash comparison)
 * 3. If YES → pay creator daily amount (0.01 USDC)
 * 4. If NO → stop payment + refund remainder to advertiser
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for Vercel Cron or manual triggers)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    console.log('Starting daily rental verification...');

    // Get all active, approved rentals that haven't failed verification
    const { data: rentals, error: rentalsError } = await supabaseAdmin
      .from('rentals')
      .select(`
        id,
        listing_id,
        ad_image_url,
        ad_image_hash,
        days_paid,
        duration_days,
        total_price,
        advertiser_wallet_address,
        last_verification_date,
        verification_failed,
        listings!inner (
          screen_name,
          price_per_day,
          wallet_address
        )
      `)
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .eq('payment_status', 'paid')
      .eq('verification_failed', false);

    if (rentalsError) {
      console.error('Error fetching rentals:', rentalsError);
      return NextResponse.json(
        { error: 'Failed to fetch rentals', details: rentalsError.message },
        { status: 500 }
      );
    }

    if (!rentals || rentals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active rentals to verify',
        verified: 0,
        paid: 0,
        failed: 0,
      });
    }

    console.log(`Found ${rentals.length} active rentals to verify`);

    let verifiedCount = 0;
    let paidCount = 0;
    let failedCount = 0;

    // Process each rental
    for (const rental of rentals) {
      try {
        console.log(`Verifying rental ${rental.id} for @${rental.listings.screen_name}`);

        // Check if we've verified today (skip if already verified within last 20 hours)
        if (rental.last_verification_date) {
          const lastVerification = new Date(rental.last_verification_date);
          const hoursSinceVerification = (Date.now() - lastVerification.getTime()) / (1000 * 60 * 60);
          if (hoursSinceVerification < 20) {
            console.log(`Skipping rental ${rental.id} - verified ${hoursSinceVerification.toFixed(1)} hours ago`);
            continue;
          }
        }

        // Take screenshot of X profile
        const screenshotBuffer = await takeScreenshot(`https://x.com/${rental.listings.screen_name}`);

        if (!screenshotBuffer) {
          console.error(`Failed to take screenshot for rental ${rental.id}`);
          continue;
        }

        // Extract banner area from screenshot (X banner is typically at the top)
        // X banner dimensions: ~1500x500px, but in screenshot it's scaled
        const bannerArea = await extractBannerArea(screenshotBuffer);

        // Calculate hash of banner area
        const currentBannerHash = crypto.createHash('sha256').update(bannerArea).digest('hex');

        // Compare with stored ad image hash
        const adImageHash = rental.ad_image_hash;

        if (!adImageHash) {
          console.warn(`No ad image hash stored for rental ${rental.id}, skipping verification`);
          continue;
        }

        // Use image similarity check (hash comparison with tolerance)
        const isAdStillThere = await compareImages(bannerArea, rental.ad_image_url);

        // Update last verification date
        await supabaseAdmin
          .from('rentals')
          .update({
            last_verification_date: new Date().toISOString(),
          })
          .eq('id', rental.id);

        if (isAdStillThere) {
          // Ad is still there - pay creator daily amount
          console.log(`✓ Ad verified for rental ${rental.id} - paying daily amount`);

          const dailyAmount = rental.listings.price_per_day;
          const newDaysPaid = (rental.days_paid || 0) + 1;

          // Update days_paid
          await supabaseAdmin
            .from('rentals')
            .update({
              days_paid: newDaysPaid,
            })
            .eq('id', rental.id);

          // TODO: Send payment to creator using x402 or CDP
          // For now, we just track the days_paid
          // In production, you would:
          // 1. Use CDP SDK to send USDC to creator's wallet (rental.listings.wallet_address)
          // 2. Record payment transaction hash

          verifiedCount++;
          paidCount++;

          // Check if rental period is complete
          if (newDaysPaid >= rental.duration_days) {
            await supabaseAdmin
              .from('rentals')
              .update({
                status: 'completed',
              })
              .eq('id', rental.id);
            console.log(`Rental ${rental.id} completed - reached duration limit`);
          }
        } else {
          // Ad is not there - stop payment and refund remainder
          console.log(`✗ Ad verification failed for rental ${rental.id} - stopping payments and refunding`);

          const daysRemaining = rental.duration_days - (rental.days_paid || 0);
          const refundAmount = daysRemaining * rental.listings.price_per_day;

          // Mark as verification failed
          await supabaseAdmin
            .from('rentals')
            .update({
              verification_failed: true,
              status: 'failed',
              refund_amount: refundAmount,
            })
            .eq('id', rental.id);

          // Send refund to advertiser
          // Note: For production, implement actual USDC refund using CDP SDK or x402
          console.log(`Refund due: ${refundAmount} USDC to ${rental.advertiser_wallet_address}`);
          // TODO: Implement actual refund transfer
          // Record refund amount (transaction hash will be added when payment is sent)

          verifiedCount++;
          failedCount++;
        }
      } catch (error) {
        console.error(`Error processing rental ${rental.id}:`, error);
        // Continue with next rental
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily verification completed',
      verified: verifiedCount,
      paid: paidCount,
      failed: failedCount,
      total: rentals.length,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in daily verification cron:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Take screenshot of X profile page
 */
async function takeScreenshot(url: string): Promise<Buffer | null> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for profile banner to load
    await page.waitForSelector('div[data-testid="ProfileHeader"]', { timeout: 10000 }).catch(() => {
      // Banner might not be visible, continue anyway
    });

    const screenshot = await page.screenshot({ fullPage: false });
    return screenshot as Buffer;
  } catch (error) {
    console.error('Error taking screenshot:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract banner area from screenshot
 * X banner is typically at the top ~20% of the page
 */
async function extractBannerArea(screenshotBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(screenshotBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image metadata');
    }

    // Extract top 20% of image (banner area)
    const bannerHeight = Math.floor(metadata.height * 0.2);

    const bannerArea = await image
      .extract({
        left: 0,
        top: 0,
        width: metadata.width,
        height: bannerHeight,
      })
      .toBuffer();

    return bannerArea;
  } catch (error) {
    console.error('Error extracting banner area:', error);
    throw error;
  }
}

/**
 * Compare current banner with stored ad image
 * Returns true if images are similar (ad is still there)
 */
async function compareImages(currentBannerBuffer: Buffer, adImageUrl: string): Promise<boolean> {
  try {
    // Load ad image
    let adImageBuffer: Buffer;
    if (adImageUrl.startsWith('data:image')) {
      const base64Data = adImageUrl.split(',')[1];
      adImageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const response = await fetch(adImageUrl);
      const arrayBuffer = await response.arrayBuffer();
      adImageBuffer = Buffer.from(arrayBuffer);
    }

    // Resize both images to same dimensions for comparison
    const comparisonSize = 300;
    const currentResized = await sharp(currentBannerBuffer)
      .resize(comparisonSize, comparisonSize, { fit: 'cover' })
      .greyscale()
      .toBuffer();

    const adResized = await sharp(adImageBuffer)
      .resize(comparisonSize, comparisonSize, { fit: 'cover' })
      .greyscale()
      .toBuffer();

    // Calculate perceptual hash (simpler than full image comparison)
    const currentHash = calculatePerceptualHash(currentResized);
    const adHash = calculatePerceptualHash(adResized);

    // Calculate hamming distance
    const hammingDistance = calculateHammingDistance(currentHash, adHash);

    // If hamming distance is low, images are similar
    // Threshold: allow up to 10% difference (for compression/rendering differences)
    const threshold = Math.floor(currentHash.length * 0.1);
    const isSimilar = hammingDistance <= threshold;

    console.log(`Image comparison: hamming distance = ${hammingDistance}, threshold = ${threshold}, similar = ${isSimilar}`);

    return isSimilar;
  } catch (error) {
    console.error('Error comparing images:', error);
    // On error, assume ad is still there (fail-safe)
    return true;
  }
}

/**
 * Calculate simple perceptual hash
 */
function calculatePerceptualHash(buffer: Buffer): string {
  // Simple hash: average pixel value
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i];
  }
  const avg = sum / buffer.length;

  // Create binary hash based on threshold
  let hash = '';
  for (let i = 0; i < buffer.length; i++) {
    hash += buffer[i] > avg ? '1' : '0';
  }

  return hash;
}

/**
 * Calculate Hamming distance between two binary strings
 */
function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Math.max(hash1.length, hash2.length);
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

// Note: Payment and refund logic needs to be implemented using CDP SDK
// For USDC transfers, you'll need to:
// 1. Use CDP SDK's wallet methods to interact with ERC-20 contracts
// 2. Or use x402 protocol for automated payments
// 3. USDC contract on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e

