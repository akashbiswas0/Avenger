# Supabase Quick Start Guide

## Database Setup

### Step 1: Run the Schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `schema.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

### Step 2: Verify the Table

After running the schema, verify the table was created:

1. Go to **Table Editor** in Supabase
2. You should see the `x_accounts` table
3. Check that it has the following columns:
   - `id` (uuid)
   - `user_id` (uuid)
   - `x_user_id` (text)
   - `screen_name` (text)
   - `encrypted_access_token` (text)
   - `encrypted_access_token_secret` (text)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

### Step 3: Get Your Keys

1. Go to **Project Settings** > **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## What the Schema Does

- Creates the `x_accounts` table to store encrypted OAuth tokens
- Sets up Row Level Security (RLS) so users can only access their own data
- Creates indexes for faster queries
- Adds an automatic `updated_at` timestamp trigger

## Security Notes

⚠️ **Important**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Only use it server-side and never expose it to the client!

## Testing the Setup

After setup, you can test by:

1. Connecting an X account through the `/listing` page
2. Checking the `x_accounts` table in Supabase to see the encrypted tokens

