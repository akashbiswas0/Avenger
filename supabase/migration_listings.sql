-- Create listings table to store banner rental listings
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_account_id UUID REFERENCES x_accounts(id) ON DELETE CASCADE,
  x_user_id TEXT NOT NULL,
  screen_name TEXT NOT NULL,
  wallet_address TEXT,
  price_per_day DECIMAL(10, 2) NOT NULL,
  min_days INTEGER NOT NULL DEFAULT 7,
  message TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_listings_x_account_id ON listings(x_account_id);
CREATE INDEX IF NOT EXISTS idx_listings_x_user_id ON listings(x_user_id);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(active);
CREATE INDEX IF NOT EXISTS idx_listings_screen_name ON listings(screen_name);

-- Enable Row Level Security (RLS)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (can be restricted later with proper auth)
CREATE POLICY "Allow all operations for listings"
  ON listings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

