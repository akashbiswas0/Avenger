-- Add approval_status and daily payment tracking to rentals table
-- This migration is idempotent

-- Add approval_status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE rentals ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Add days_paid column to track how many days have been paid
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'days_paid'
  ) THEN
    ALTER TABLE rentals ADD COLUMN days_paid INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add last_verification_date to track when we last checked
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'last_verification_date'
  ) THEN
    ALTER TABLE rentals ADD COLUMN last_verification_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add verification_failed to track if ad was removed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'verification_failed'
  ) THEN
    ALTER TABLE rentals ADD COLUMN verification_failed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add refund_tx_hash to track refund transaction
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'refund_tx_hash'
  ) THEN
    ALTER TABLE rentals ADD COLUMN refund_tx_hash TEXT;
  END IF;
END $$;

-- Add ad_image_hash to store hash of the ad image for comparison
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'ad_image_hash'
  ) THEN
    ALTER TABLE rentals ADD COLUMN ad_image_hash TEXT;
  END IF;
END $$;

-- Add refund_amount column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'refund_amount'
  ) THEN
    ALTER TABLE rentals ADD COLUMN refund_amount NUMERIC;
  END IF;
END $$;

-- Add started_at column (when rental actually started after approval)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE rentals ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add updated_at column if it doesn't exist (for tracking updates)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE rentals ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Update status column constraint to allow 'pending', 'active', 'rejected', 'completed', 'failed'
-- First, drop existing constraint if it exists
DO $$ 
BEGIN
  -- Check if there's a check constraint on status column
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'rentals' 
    AND column_name = 'status'
    AND constraint_name LIKE '%status%check%'
  ) THEN
    -- Drop the constraint (we'll recreate it with new values)
    ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_status_check;
  END IF;
END $$;

-- Add new constraint that allows all status values we need
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'rentals_status_check_new'
  ) THEN
    ALTER TABLE rentals ADD CONSTRAINT rentals_status_check_new 
    CHECK (status IN ('pending', 'active', 'rejected', 'completed', 'failed'));
  END IF;
END $$;

-- Create index for faster queries on pending approvals
CREATE INDEX IF NOT EXISTS idx_rentals_approval_status ON rentals(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_rentals_active_verification ON rentals(status, approval_status, verification_failed) WHERE status = 'active' AND approval_status = 'approved' AND verification_failed = FALSE;

