import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

// X API OAuth 1.0a credentials
const X_CONSUMER_KEY = process.env.X_API_KEY || process.env.X_CONSUMER_KEY || '';
const X_CONSUMER_SECRET = process.env.X_API_SECRET || process.env.X_CONSUMER_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rentalId } = body;

    if (!rentalId) {
      return NextResponse.json(
        { error: 'Missing rentalId' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    console.log('Banner flip initiated for rental:', rentalId);

    // 1. Get the rental
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .select('id, listing_id, ad_image_url, status, payment_status, approval_status')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) {
      console.error('Rental not found:', rentalError);
      return NextResponse.json(
        { error: 'Rental not found' },
        { status: 404 }
      );
    }

    // Check if rental is paid
    if (rental.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Rental payment not confirmed' },
        { status: 400 }
      );
    }

    // Check if rental is approved
    if (rental.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Rental not approved by creator' },
        { status: 400 }
      );
    }

    // Check if rental is approved
    if (rental.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Rental not approved by creator' },
        { status: 400 }
      );
    }

    // 2. Get the listing with X account info
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, x_account_id, screen_name, x_user_id')
      .eq('id', rental.listing_id)
      .single();

    if (listingError || !listing) {
      console.error('Listing not found:', listingError);
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // 3. Get the X account with encrypted tokens
    let xAccountData;
    const { data: xAccount, error: xAccountError } = await supabaseAdmin
      .from('x_accounts')
      .select('id, encrypted_access_token, encrypted_token_secret, x_user_id')
      .eq('id', listing.x_account_id || listing.x_user_id)
      .single();

    if (xAccountError || !xAccount) {
      // Try to find by x_user_id if x_account_id wasn't set
      const { data: xAccountByUserId } = await supabaseAdmin
        .from('x_accounts')
        .select('id, encrypted_access_token, encrypted_token_secret, x_user_id')
        .eq('x_user_id', listing.x_user_id)
        .single();

      if (!xAccountByUserId) {
        console.error('X account not found:', xAccountError);
        return NextResponse.json(
          { error: 'X account not found for this listing' },
          { status: 404 }
        );
      }

      xAccountData = xAccountByUserId;
    } else {
      xAccountData = xAccount;
    }

    // Check if we have OAuth 1.0a tokens
    // Note: We're currently storing OAuth 2.0 tokens, but X v1.1 API requires OAuth 1.0a
    // For now, we'll check if encrypted_token_secret exists (OAuth 1.0a) or use OAuth 2.0 approach
    const hasOAuth1Tokens = xAccountData.encrypted_token_secret;

    if (!hasOAuth1Tokens) {
      console.warn('OAuth 1.0a tokens not found. X v1.1 banner update requires OAuth 1.0a tokens.');
      // TODO: Implement OAuth 1.0a token storage or use OAuth 2.0 with v2 API if available
      return NextResponse.json(
        { 
          error: 'OAuth 1.0a tokens required for banner update',
          message: 'Please reconnect your X account with OAuth 1.0a to enable banner updates'
        },
        { status: 400 }
      );
    }

    // 4. Decrypt OAuth 1.0a tokens
    let accessToken: string;
    let tokenSecret: string;

    try {
      accessToken = decrypt(xAccountData.encrypted_access_token);
      tokenSecret = decrypt(xAccountData.encrypted_token_secret);
    } catch (decryptError) {
      console.error('Failed to decrypt tokens:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt X account tokens' },
        { status: 500 }
      );
    }

    // 5. Get the ad image
    let imageBuffer: Buffer;
    try {
      // If ad_image_url is base64, convert it to buffer
      if (rental.ad_image_url.startsWith('data:image')) {
        // Extract base64 data
        const base64Data = rental.ad_image_url.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // If it's a URL, fetch it
        const imageResponse = await fetch(rental.ad_image_url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }
    } catch (imageError) {
      console.error('Failed to process ad image:', imageError);
      return NextResponse.json(
        { error: 'Failed to process ad image' },
        { status: 500 }
      );
    }

    // 6. Create OAuth 1.0a signature
    if (!X_CONSUMER_KEY || !X_CONSUMER_SECRET) {
      return NextResponse.json(
        { error: 'X API credentials not configured' },
        { status: 500 }
      );
    }

    const oauth = new OAuth({
      consumer: {
        key: X_CONSUMER_KEY,
        secret: X_CONSUMER_SECRET,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      },
    });

    const requestData = {
      url: 'https://upload.twitter.com/1.1/account/update_profile_banner.json',
      method: 'POST',
    };

    const token = {
      key: accessToken,
      secret: tokenSecret,
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    // 7. Prepare multipart form data
    const form = new FormData();
    // Convert Buffer to Uint8Array for Blob
    const uint8Array = new Uint8Array(imageBuffer);
    const blob = new Blob([uint8Array], { type: 'image/jpeg' });
    form.append('banner', blob, 'banner.jpg');

    console.log('Uploading banner to X API for:', listing.screen_name);

    // 8. Upload banner to X
    const xApiResponse = await fetch('https://upload.twitter.com/1.1/account/update_profile_banner.json', {
      method: 'POST',
      headers: {
        ...authHeader,
      },
      body: form,
    });

    if (!xApiResponse.ok) {
      const errorText = await xApiResponse.text();
      console.error('X API error:', {
        status: xApiResponse.status,
        statusText: xApiResponse.statusText,
        error: errorText,
      });
      return NextResponse.json(
        { 
          error: 'Failed to update X banner',
          details: errorText,
          status: xApiResponse.status,
        },
        { status: 500 }
      );
    }

    const xApiResult = await xApiResponse.json();
    console.log('Banner updated successfully:', xApiResult);

    // 8. Update rental status to active and save banner URL if available
    const { error: updateError } = await supabaseAdmin
      .from('rentals')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        // Save current banner URL if X API returns it
        current_banner_url: xApiResult?.banner_url || rental.ad_image_url,
      })
      .eq('id', rentalId);

    if (updateError) {
      console.error('Failed to update rental status:', updateError);
      // Don't fail the request if banner was updated but DB update failed
    }

    return NextResponse.json({
      success: true,
      message: 'Banner flipped successfully',
      screenName: listing.screen_name,
      bannerUrl: xApiResult?.banner_url,
    }, { status: 200 });

  } catch (error) {
    console.error('Error flipping banner:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

