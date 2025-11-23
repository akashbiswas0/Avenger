import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get X account identifier from request body or query params
    const body = await request.json().catch(() => ({}));
    const xUserId = body.x_user_id || request.nextUrl.searchParams.get('x_user_id');
    const screenName = body.screen_name || request.nextUrl.searchParams.get('screen_name');

    if (!xUserId && !screenName) {
      return NextResponse.json({ error: 'Missing account identifier' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    let query = supabaseAdmin.from('x_accounts').delete();

    if (xUserId) {
      query = query.eq('x_user_id', xUserId);
    } else {
      query = query.eq('screen_name', screenName);
    }

    const { error } = await query;

    if (error) {
      console.error('Disconnect error:', error);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

