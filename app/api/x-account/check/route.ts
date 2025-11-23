import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get user from session (implement your auth system)
    const userId = request.cookies.get('user_id')?.value;
    
    if (!userId) {
      return NextResponse.json({ connected: false });
    }

    const { data, error } = await supabaseAdmin
      .from('x_accounts')
      .select('screen_name')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      screenName: data.screen_name,
    });
  } catch (error) {
    console.error('Check account error:', error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}

