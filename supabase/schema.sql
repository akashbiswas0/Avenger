-- Create users table to store X account connections
CREATE TABLE IF NOT EXISTS x_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  x_user_id TEXT UNIQUE NOT NULL,
  screen_name TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_x_accounts_user_id ON x_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_x_accounts_x_user_id ON x_accounts(x_user_id);
CREATE INDEX IF NOT EXISTS idx_x_accounts_screen_name ON x_accounts(screen_name);

-- Enable Row Level Security (RLS)
ALTER TABLE x_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (can be restricted later with proper auth)
-- In production, you'll want to implement proper user authentication
CREATE POLICY "Allow all operations for x_accounts"
  ON x_accounts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_x_accounts_updated_at
  BEFORE UPDATE ON x_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

