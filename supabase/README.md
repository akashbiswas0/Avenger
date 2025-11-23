# Supabase Database Setup

## Running the Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `schema.sql`
4. Run the query

Alternatively, you can use the Supabase CLI:

```bash
supabase db push
```

## Table Structure

### `x_accounts` table

Stores encrypted X (Twitter) OAuth tokens for each user.

**Columns:**
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to auth.users
- `x_user_id` (TEXT): X/Twitter user ID (unique)
- `screen_name` (TEXT): X/Twitter handle (e.g., @username)
- `encrypted_access_token` (TEXT): Encrypted OAuth access token
- `encrypted_access_token_secret` (TEXT): Encrypted OAuth access token secret
- `created_at` (TIMESTAMP): Account connection timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

## Security

- Row Level Security (RLS) is enabled
- Users can only access their own X account records
- All tokens are stored encrypted

## Notes

- Make sure to set up encryption/decryption on your backend before storing tokens
- The `screen_name` field stores the handle without the @ symbol
- Consider adding additional fields like `profile_image_url`, `name`, etc. if needed

