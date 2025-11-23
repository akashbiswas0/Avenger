-- Create users table to store X account connections
CREATE TABLE IF NOT EXISTS x_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  x_user_id TEXT UNIQUE NOT NULL,
  screen_name TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_access_token_secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_x_accounts_user_id ON x_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_x_accounts_x_user_id ON x_accounts(x_user_id);
CREATE INDEX IF NOT EXISTS idx_x_accounts_screen_name ON x_accounts(screen_name);

-- Enable Row Level Security (RLS)
ALTER TABLE x_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own X accounts
CREATE POLICY "Users can view their own X accounts"
  ON x_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own X accounts
CREATE POLICY "Users can insert their own X accounts"
  ON x_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own X accounts
CREATE POLICY "Users can update their own X accounts"
  ON x_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own X accounts
CREATE POLICY "Users can delete their own X accounts"
  ON x_accounts FOR DELETE
  USING (auth.uid() = user_id);

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

