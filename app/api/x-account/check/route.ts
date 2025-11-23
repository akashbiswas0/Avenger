import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Check if we have an X account identifier in query params or check all accounts
    // Since we're not using cookies/localStorage, we'll check for the most recent account
    // In a real app, you'd pass the x_user_id or screen_name as a query param
    
    // Only check Supabase if it's configured
    if (!supabaseAdmin) {
      return NextResponse.json({ connected: false });
    }

    // Get x_user_id or screen_name from query params if provided
    const xUserId = request.nextUrl.searchParams.get('x_user_id');
    const screenName = request.nextUrl.searchParams.get('screen_name');

    let query = supabaseAdmin
      .from('x_accounts')
      .select('screen_name, expires_at, x_user_id');

    if (xUserId) {
      query = query.eq('x_user_id', xUserId);
    } else if (screenName) {
      query = query.eq('screen_name', screenName);
    } else {
      // If no identifier provided, get the most recently updated account
      // This is a fallback - in production you'd want proper session management
      query = query.order('updated_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      screenName: data.screen_name,
      xUserId: data.x_user_id,
    });
  } catch (error) {
    console.error('Check account error:', error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}

