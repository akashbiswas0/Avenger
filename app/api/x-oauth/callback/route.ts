import { NextRequest, NextResponse } from 'next/server';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { encrypt } from '@/lib/encryption';
import { supabaseAdmin } from '@/lib/supabase';

const X_API_KEY = process.env.X_API_KEY!;
const X_API_SECRET = process.env.X_API_SECRET!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');
    const denied = searchParams.get('denied');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

    if (denied) {
      return NextResponse.redirect(new URL('/listing?error=access_denied', baseUrl));
    }

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(new URL('/listing?error=invalid_request', baseUrl));
    }

    // Retrieve oauth_token_secret from cookie (set by client after initiate)
    // In production, use a proper session store like Redis
    const oauthTokenSecret = request.cookies.get('oauth_token_secret')?.value;

    if (!oauthTokenSecret) {
      // Try to get from query params as fallback (less secure, but works for demo)
      // In production, always use server-side session storage
      return NextResponse.redirect(new URL('/listing?error=session_expired', baseUrl));
    }

    // Create OAuth instance
    const oauth = new OAuth({
      consumer: {
        key: X_API_KEY,
        secret: X_API_SECRET,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString, key) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      },
    });

    // Exchange request token for access token
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    
    const requestData = {
      url: accessTokenUrl,
      method: 'POST',
    };

    const token = {
      key: oauthToken,
      secret: oauthTokenSecret,
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const response = await fetch(`${accessTokenUrl}?oauth_verifier=${oauthVerifier}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader.Authorization,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to exchange token');
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    
    const accessToken = params.get('oauth_token');
    const accessTokenSecret = params.get('oauth_token_secret');
    const userId = params.get('user_id');
    const screenName = params.get('screen_name');

    if (!accessToken || !accessTokenSecret || !userId || !screenName) {
      throw new Error('Invalid token response');
    }

    // Get user from session (you'll need to implement proper auth)
    // For now, using a placeholder - implement your auth system
    const userIdFromSession = request.cookies.get('user_id')?.value;
    
    if (!userIdFromSession) {
      // In production, you'd redirect to login
      return NextResponse.redirect(new URL('/listing?error=not_authenticated', baseUrl));
    }

    // Encrypt tokens
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedAccessTokenSecret = encrypt(accessTokenSecret);

    // Save to Supabase
    const { error: dbError } = await supabaseAdmin
      .from('x_accounts')
      .upsert({
        user_id: userIdFromSession,
        x_user_id: userId,
        screen_name: screenName,
        encrypted_access_token: encryptedAccessToken,
        encrypted_access_token_secret: encryptedAccessTokenSecret,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'x_user_id',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect(new URL('/listing?error=database_error', baseUrl));
    }

    // Clear the temporary oauth_token_secret cookie
    const responseRedirect = NextResponse.redirect(new URL('/listing?connected=true', baseUrl));
    responseRedirect.cookies.delete('oauth_token_secret');
    responseRedirect.cookies.delete('oauth_token');
    
    return responseRedirect;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL('/listing?error=oauth_failed', baseUrl));
  }
}

