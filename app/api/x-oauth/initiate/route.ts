import { NextRequest, NextResponse } from 'next/server';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

const X_API_KEY = process.env.X_API_KEY!;
const X_API_SECRET = process.env.X_API_SECRET!;
const X_CALLBACK_URL = process.env.X_CALLBACK_URL || `${process.env.NEXT_PUBLIC_BASE_URL}/api/x-oauth/callback`;

export async function POST(request: NextRequest) {
  try {
    // Create OAuth 1.0a instance
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

    // Request token endpoint
    const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
    
    const requestData = {
      url: requestTokenUrl,
      method: 'POST',
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));

    // Make request to get request token
    const response = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader.Authorization,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get request token');
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Invalid response from Twitter');
    }

    // Store oauth_token_secret in session/cookie (you might want to use a proper session store)
    // For now, we'll return it to the client to store temporarily
    // In production, use a secure session store like Redis or database

    // Build authorization URL
    const authorizationUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;

    // Set cookie with oauth_token_secret (in production, use secure session store)
    const response = NextResponse.json({
      authorizationUrl,
      oauthToken,
      oauthTokenSecret, // Client will store this temporarily
    });
    
    // Set cookie for callback (7 days expiry, httpOnly in production)
    response.cookies.set('oauth_token_secret', oauthTokenSecret, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    
    response.cookies.set('oauth_token', oauthToken, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

