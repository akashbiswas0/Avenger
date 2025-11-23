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

-- Create index for faster queries on pending approvals
CREATE INDEX IF NOT EXISTS idx_rentals_approval_status ON rentals(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_rentals_active_verification ON rentals(status, approval_status, verification_failed) WHERE status = 'active' AND approval_status = 'approved' AND verification_failed = FALSE;

