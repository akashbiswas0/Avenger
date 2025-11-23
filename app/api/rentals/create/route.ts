import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CdpClient } from '@coinbase/cdp-sdk';

// Initialize CDP client for server wallet
const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
});

// Server wallet address to receive payments (set in environment)
const SERVER_WALLET_ADDRESS = process.env.CDP_SERVER_WALLET_ADDRESS || '';

/**
 * Asynchronously flip the banner after payment
 * This runs in the background and doesn't block the payment response
 */
async function flipBannerAsync(rentalId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const flipUrl = `${baseUrl}/api/banner/flip`;
    
    console.log('Triggering banner flip for rental:', rentalId);
    
    const response = await fetch(flipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rentalId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Banner flip failed:', errorData);
      return;
    }

    const result = await response.json();
    console.log('Banner flipped successfully:', result);
  } catch (error) {
    console.error('Error calling banner flip API:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, duration, totalPrice, adImage, walletAddress } = body;

    // Validate input
    if (!listingId || !duration || !totalPrice || !adImage || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if listing exists and is active
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, screen_name, price_per_day, min_days, wallet_address')
      .eq('id', listingId)
      .eq('active', true)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found or inactive' },
        { status: 404 }
      );
    }

    // Validate duration
    if (duration < listing.min_days) {
      return NextResponse.json(
        { error: `Minimum rental period is ${listing.min_days} days` },
        { status: 400 }
      );
    }

    // Validate price
    const expectedPrice = listing.price_per_day * duration;
    if (Math.abs(totalPrice - expectedPrice) > 0.01) {
      return NextResponse.json(
        { error: 'Price mismatch' },
        { status: 400 }
      );
    }

    // Check if payment header is present (x402 payment was made)
    // x402 library sends header as "X-PAYMENT" (capitalized, not "x-402-payment")
    // The header contains the payment proof/signature
    const paymentHeader = request.headers.get('x-payment') || request.headers.get('X-PAYMENT');
    
    // Log all headers for debugging
    const allHeaders = Object.fromEntries(request.headers.entries());
    console.log('Payment check - headers:', {
      'x-payment': request.headers.get('x-payment'),
      'X-PAYMENT': request.headers.get('X-PAYMENT'),
      hasPaymentHeader: !!paymentHeader,
      paymentHeaderLength: paymentHeader?.length,
      // Log first 50 chars of payment header if present
      paymentHeaderPreview: paymentHeader ? paymentHeader.substring(0, 50) + '...' : null,
      allHeaderKeys: Object.keys(allHeaders),
      serverWallet: SERVER_WALLET_ADDRESS ? `${SERVER_WALLET_ADDRESS.substring(0, 10)}...` : 'NOT SET',
      totalPrice,
    });

    // If no payment header, return 402 Payment Required
    // Note: x402 library sends X-PAYMENT header, not x-402-tx-hash
    // The transaction hash is embedded in the payment header itself
    if (!paymentHeader) {
      if (!SERVER_WALLET_ADDRESS) {
        console.error('SERVER_WALLET_ADDRESS not configured');
        return NextResponse.json(
          { error: 'Payment receiver not configured' },
          { status: 500 }
        );
      }

      // Return 402 with payment details (x402 protocol)
      // x402 library expects: { x402Version: number, accepts: PaymentRequirement[] }
      // Based on x402 spec, each requirement needs:
      // - scheme: "exact" (payment scheme type)
      // - asset: ERC-20 token contract address (USDC on Base Sepolia)
      // - payTo: recipient wallet address
      // - maxAmountRequired: amount in atomic units (USDC has 6 decimals)
      // - network: network identifier
      // - resource: the resource URL being accessed
      // - description: description of what the payment is for
      // - mimeType: MIME type of the resource
      // - maxTimeoutSeconds: payment timeout in seconds
      
      // USDC contract address on Base Sepolia testnet
      // Official USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
      // Alternative: 0x29684075a3c86ea11d9964bcaf0f956e801396bd (if the first doesn't work)
      const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
      
      // Convert price to atomic units (USDC has 6 decimals)
      // e.g., 0.01 USDC = 10000 atomic units
      const amountInAtomicUnits = Math.floor(totalPrice * 1_000_000).toString();
      
      // Construct the resource URL
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host') || 'localhost:3000';
      const resourceUrl = `${protocol}://${host}${request.nextUrl.pathname}`;
      
      const paymentRequirement = {
        scheme: 'exact', // Payment scheme - must be "exact" not "usdc"
        asset: USDC_BASE_SEPOLIA, // USDC contract address on Base Sepolia
        payTo: SERVER_WALLET_ADDRESS, // Recipient address
        maxAmountRequired: amountInAtomicUnits, // Amount in atomic units (6 decimals for USDC)
        network: 'base-sepolia', // Network identifier
        resource: resourceUrl, // The resource URL being accessed
        description: `Payment for banner rental: ${duration} days at ${totalPrice} USDC/day`, // Description
        mimeType: 'application/json', // MIME type of the response
        maxTimeoutSeconds: 300, // 5 minutes timeout for payment
      };

      // x402 response format: { x402Version: number, accepts: [...] }
      const x402Response = {
        x402Version: 1, // x402 protocol version (must be number, not string)
        accepts: [paymentRequirement], // Array of payment requirements
      };

      console.log('Returning 402 Payment Required:', {
        x402Response: JSON.stringify(x402Response),
        totalPrice,
        recipient: SERVER_WALLET_ADDRESS.substring(0, 10) + '...',
        network: 'base-sepolia',
      });

      // Create response with proper JSON serialization
      const responseBody = JSON.stringify(x402Response);
      
      return new NextResponse(responseBody, {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-402-Payment-Required': 'true',
          'X-402-Amount': totalPrice.toString(),
          'X-402-Currency': 'USDC',
          'X-402-Recipient': SERVER_WALLET_ADDRESS,
          'X-402-Network': 'base-sepolia',
        },
      });
    }


    // Payment was made, create rental record
    // Extract transaction hash from payment header if needed
    // The x402 payment header contains the payment proof
    // For now, we'll use a placeholder or extract from the header
    let paymentTxHash = paymentHeader;
    
    // Try to extract transaction hash from payment header
    // The payment header is a JSON string containing payment details
    try {
      const paymentData = JSON.parse(paymentHeader);
      paymentTxHash = paymentData.txHash || paymentData.transactionHash || paymentData.hash || paymentHeader;
    } catch (e) {
      // If not JSON, use the header itself as the identifier
      paymentTxHash = paymentHeader.substring(0, 66); // First 66 chars (typical hash length)
    }
    
    console.log('Payment confirmed:', {
      hasPaymentHeader: !!paymentHeader,
      paymentHeaderLength: paymentHeader?.length,
      paymentTxHash: paymentTxHash?.substring(0, 20) + '...',
    });

    // Verify payment with facilitator (optional but recommended)
    // For now, we trust the payment header and tx hash from the client
    // In production, you should verify the payment with the x402 facilitator
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    console.log('Creating rental record with data:', {
      listingId,
      walletAddress: walletAddress.substring(0, 10) + '...',
      duration,
      totalPrice,
      paymentTxHash: paymentTxHash?.substring(0, 20) + '...',
    });

    // Create rental record with pending approval
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .insert({
        listing_id: listingId,
        advertiser_wallet_address: walletAddress,
        ad_image_url: adImage, // In production, upload to Supabase Storage
        duration_days: duration,
        total_price: totalPrice,
        payment_tx_hash: paymentTxHash,
        payment_status: 'paid',
        approval_status: 'pending', // Requires creator approval
        status: 'pending', // Not active until approved
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days_paid: 0,
        verification_failed: false,
      })
      .select()
      .single();

    if (rentalError) {
      console.error('Error creating rental:', {
        error: rentalError,
        code: rentalError.code,
        message: rentalError.message,
        details: rentalError.details,
        hint: rentalError.hint,
      });
      return NextResponse.json(
        { 
          error: 'Failed to create rental',
          details: rentalError.message,
          code: rentalError.code,
        },
        { status: 500 }
      );
    }

    console.log('Rental created successfully:', {
      rentalId: rental.id,
      status: rental.status,
      approval_status: rental.approval_status,
    });

    // Note: Banner flip will be triggered after creator approval, not immediately
    // The creator needs to approve the request in their dashboard first

    return NextResponse.json({
      success: true,
      rentalId: rental.id,
      message: 'Rental request created. Waiting for creator approval.',
      approvalStatus: 'pending',
    }, { status: 200 });
  } catch (error) {
    console.error('Error in rental creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


