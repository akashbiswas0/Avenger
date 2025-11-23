import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rentalId, action } = body;

    if (!rentalId || !action) {
      return NextResponse.json(
        { error: 'Missing rentalId or action' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get the rental to verify it exists and get listing info
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .select('id, listing_id, ad_image_url, approval_status, payment_status')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) {
      return NextResponse.json(
        { error: 'Rental not found' },
        { status: 404 }
      );
    }

    if (rental.approval_status !== 'pending') {
      return NextResponse.json(
        { error: 'Rental already processed' },
        { status: 400 }
      );
    }

    if (rental.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not confirmed' },
        { status: 400 }
      );
    }

    // Calculate image hash for verification
    let adImageHash: string | null = null;
    if (rental.ad_image_url && rental.ad_image_url.startsWith('data:image')) {
      // Extract base64 data and create hash
      const base64Data = rental.ad_image_url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      adImageHash = crypto.createHash('sha256').update(buffer).digest('hex');
    }

    // Update rental approval status
    const updateData: any = {
      approval_status: action,
    };

    // Add updated_at if column exists (will be added by migration)
    // Supabase might handle this automatically with triggers, but we set it explicitly
    updateData.updated_at = new Date().toISOString();

    if (action === 'approved') {
      // If approved, set status to active and store image hash
      updateData.status = 'active';
      updateData.started_at = new Date().toISOString();
      if (adImageHash) {
        updateData.ad_image_hash = adImageHash;
      }
    } else {
      // If rejected, set status to rejected
      updateData.status = 'rejected';
    }

    console.log('Updating rental with data:', {
      rentalId,
      action,
      updateData: {
        ...updateData,
        ad_image_hash: updateData.ad_image_hash ? `${updateData.ad_image_hash.substring(0, 20)}...` : null,
      },
    });

    const { data: updatedRental, error: updateError } = await supabaseAdmin
      .from('rentals')
      .update(updateData)
      .eq('id', rentalId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating rental:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        updateData,
      });
      return NextResponse.json(
        { 
          error: 'Failed to update rental', 
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint,
        },
        { status: 500 }
      );
    }

    // If approved, trigger banner flip
    if (action === 'approved') {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const flipUrl = `${baseUrl}/api/banner/flip`;
        
        // Trigger banner flip asynchronously
        fetch(flipUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rentalId }),
        }).catch((error) => {
          console.error('Error triggering banner flip:', error);
          // Don't fail the approval if banner flip fails
        });
      } catch (error) {
        console.error('Error calling banner flip:', error);
      }
    }

    return NextResponse.json({
      success: true,
      rental: updatedRental,
      message: `Rental ${action} successfully`,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in rental approval:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

