import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { storeOAuthState } from '@/lib/oauth-state-store';

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
// Twitter doesn't accept 'localhost' - must use 127.0.0.1
const X_REDIRECT_URI = process.env.X_REDIRECT_URI || 
  (process.env.NEXT_PUBLIC_BASE_URL 
    ? process.env.NEXT_PUBLIC_BASE_URL.replace('localhost', '127.0.0.1') + '/api/x-oauth2/callback'
    : 'http://127.0.0.1:3000/api/x-oauth2/callback');

export async function GET(request: NextRequest) {
  try {
    // Validate environment variables
    if (!X_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing X_CLIENT_ID' },
        { status: 500 }
      );
    }

    console.log('OAuth2 Authorize - Redirect URI:', X_REDIRECT_URI);
    console.log('OAuth2 Authorize - Client ID:', X_CLIENT_ID.substring(0, 4) + '...');

    // Generate state parameter for CSRF protection
    const state = randomUUID();
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    // Build OAuth 2.0 authorization URL
    // Note: Twitter will show login page first if user is not logged in
    // After login, it will automatically proceed to authorization
    const authUrl = `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(X_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(X_REDIRECT_URI)}&` +
      `scope=tweet.read%20users.read%20offline.access&` +
      `state=${state}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`;
    
    console.log('OAuth2 Authorize URL:', authUrl);
    console.log('Full OAuth flow:');
    console.log('  1. User will see Twitter login page (if not logged in)');
    console.log('  2. After login, Twitter will show authorization screen');
    console.log('  3. User approves → redirects to callback with code');
    
    // Store state and code_verifier in cookies for verification
    const response = NextResponse.redirect(authUrl);

    // Clear any existing OAuth cookies first to avoid conflicts
    response.cookies.delete('oauth2_state');
    response.cookies.delete('oauth2_code_verifier');
    
    // Store state and code_verifier in httpOnly cookies
    // Set explicit path to ensure cookie is available for callback
    const cookieOptions = {
      maxAge: 60 * 10, // 10 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/', // Explicit path to ensure cookie is available everywhere
    };

    response.cookies.set('oauth2_state', state, cookieOptions);
    response.cookies.set('oauth2_code_verifier', codeVerifier, cookieOptions);
    
    // Also store in memory as fallback (in case cookies don't work)
    storeOAuthState(state, codeVerifier, 600); // 10 minutes
    
    console.log('OAuth2 state stored:', {
      state: state,
      codeVerifier: codeVerifier.substring(0, 20) + '...',
      path: cookieOptions.path,
      sameSite: cookieOptions.sameSite,
      inMemory: true,
    });

    return response;
  } catch (error) {
    console.error('OAuth2 authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth2 flow' },
      { status: 500 }
    );
  }
}

