import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { getOAuthState, deleteOAuthState } from '@/lib/oauth-state-store';

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
// Twitter doesn't accept 'localhost' - must use 127.0.0.1
const X_REDIRECT_URI = process.env.X_REDIRECT_URI || 
  (process.env.NEXT_PUBLIC_BASE_URL 
    ? process.env.NEXT_PUBLIC_BASE_URL.replace('localhost', '127.0.0.1') + '/api/x-oauth2/callback'
    : 'http://127.0.0.1:3000/api/x-oauth2/callback');

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Ensure we use 127.0.0.1 instead of localhost to match Twitter callback URL
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    baseUrl = baseUrl.replace('localhost', '127.0.0.1');

    console.log('OAuth2 Callback received:');
    console.log('  - code:', code ? 'present' : 'missing');
    console.log('  - state:', state ? 'present' : 'missing');
    console.log('  - error:', error || 'none');
    console.log('  - All params:', Object.fromEntries(searchParams.entries()));

    if (error) {
      console.error('OAuth2 error from Twitter:', error);
      return NextResponse.redirect(new URL(`/verification?error=${encodeURIComponent(error)}`, baseUrl));
    }

    if (!code || !state) {
      console.error('Missing code or state:', { code: !!code, state: !!state });
      return NextResponse.redirect(new URL('/verification?error=invalid_request', baseUrl));
    }

    // Verify state parameter (CSRF protection)
    // Try memory store first (more reliable), then fallback to cookie
    const storedStateFromMemory = getOAuthState(state);
    const storedStateFromCookie = request.cookies.get('oauth2_state')?.value;
    
    console.log('State verification:');
    console.log('  - Received state:', state);
    console.log('  - Stored state (memory):', storedStateFromMemory ? 'FOUND' : 'MISSING');
    console.log('  - Stored state (cookie):', storedStateFromCookie || 'MISSING');
    console.log('  - All cookies:', request.cookies.getAll().map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })));
    
    // Verify state matches (prefer memory store, fallback to cookie)
    let stateValid = false;
    let codeVerifier: string | null = null;
    
    if (storedStateFromMemory && storedStateFromMemory.state === state) {
      // State matches memory store (preferred method)
      stateValid = true;
      codeVerifier = storedStateFromMemory.codeVerifier;
      console.log('  - State verified via memory store');
      // Clean up memory store
      deleteOAuthState(state);
    } else if (storedStateFromCookie && state === storedStateFromCookie) {
      // State matches cookie (fallback)
      stateValid = true;
      codeVerifier = request.cookies.get('oauth2_code_verifier')?.value || null;
      console.log('  - State verified via cookie (fallback)');
    }
    
    if (!stateValid) {
      console.error('State mismatch - possible CSRF attack or cookie issue');
      console.error('  - Received state:', state);
      console.error('  - Expected (memory):', storedStateFromMemory?.state || 'NOT FOUND');
      console.error('  - Expected (cookie):', storedStateFromCookie || 'NOT FOUND');
      // Import getAllStates for debugging
      const { getAllStates } = await import('@/lib/oauth-state-store');
      const allStates = getAllStates();
      console.error('  - All states in memory:', allStates);
      return NextResponse.redirect(new URL('/verification?error=invalid_state', baseUrl));
    }
    
    if (!codeVerifier) {
      console.error('Code verifier not found in memory or cookie');
      return NextResponse.redirect(new URL('/verification?error=missing_code_verifier', baseUrl));
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: X_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      return NextResponse.redirect(new URL('/verification?error=token_exchange_failed', baseUrl));
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      return NextResponse.redirect(new URL('/verification?error=no_access_token', baseUrl));
    }

    // Get user info from Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('Failed to get user info');
      return NextResponse.redirect(new URL('/verification?error=user_info_failed', baseUrl));
    }

    const userData = await userResponse.json();
    const xUserId = userData.data?.id;
    const screenName = userData.data?.username;

    if (!xUserId || !screenName) {
      return NextResponse.redirect(new URL('/verification?error=invalid_user_data', baseUrl));
    }

    // Encrypt access token
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Calculate expiration time
    const expiresAt = expires_in 
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Save to Supabase (only if configured)
    let userId: string | null = null;
    if (supabaseAdmin) {
      // Check if account already exists by x_user_id
      const { data: existingAccount } = await supabaseAdmin
        .from('x_accounts')
        .select('user_id')
        .eq('x_user_id', xUserId)
        .single();

      // Reuse existing user_id if account exists, otherwise generate new one
      userId = existingAccount?.user_id || randomUUID();

      const { error: dbError } = await supabaseAdmin
        .from('x_accounts')
        .upsert({
          user_id: userId,
          x_user_id: xUserId,
          screen_name: screenName,
          encrypted_access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'x_user_id',
        });

      if (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.redirect(new URL('/verification?error=database_error', baseUrl));
      }
    } else {
      console.warn('Supabase not configured - skipping database save');
      // For demo purposes, we'll still show success even without DB
    }

    // Clear OAuth cookies (we don't need user_id cookie anymore)
    // Redirect with screen name in URL so frontend can identify the account
    const redirectUrl = new URL('/verification', baseUrl);
    redirectUrl.searchParams.set('connected', 'true');
    redirectUrl.searchParams.set('account', screenName); // Pass screen name for immediate identification
    
    const responseRedirect = NextResponse.redirect(redirectUrl);
    responseRedirect.cookies.delete('oauth2_state');
    responseRedirect.cookies.delete('oauth2_code_verifier');
    
    console.log('Redirecting to:', redirectUrl.toString());

    return responseRedirect;
  } catch (error) {
    console.error('OAuth2 callback error:', error);
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    baseUrl = baseUrl.replace('localhost', '127.0.0.1');
    return NextResponse.redirect(new URL('/verification?error=oauth_failed', baseUrl));
  }
}

