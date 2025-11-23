# Avenger

A modern Next.js landing page with neobrutalism design style, featuring X (Twitter) OAuth integration for connecting user accounts.

## Features

- **Neobrutalism Design**: Bold borders, high contrast, geometric shapes, and offset shadows
- **Minimalistic Theme**: Clean, simple layout with focus on content
- **X OAuth Integration**: Connect X accounts using OAuth 1.0a
- **Encrypted Token Storage**: Secure storage of OAuth tokens in Supabase
- **Responsive**: Works on all device sizes
- **Next.js 14**: Built with the latest Next.js App Router

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase/schema.sql` in your Supabase SQL Editor
3. Get your Supabase URL and keys from Project Settings > API

### 3. Set Up X (Twitter) API

1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Create a new app and get your API Key and API Secret
3. Set the callback URL to: `http://localhost:3000/api/x-oauth/callback` (or your production URL)

### 4. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `X_API_KEY`
- `X_API_SECRET`
- `ENCRYPTION_KEY` (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Schema

The application uses Supabase to store encrypted X OAuth tokens. See `supabase/schema.sql` for the complete schema.

### Key Tables

- `x_accounts`: Stores encrypted access tokens and user information

## OAuth Flow

1. User clicks "Connect X" on `/verification` page
2. Backend initiates OAuth 1.0a flow
3. User authorizes on X/Twitter
4. Callback receives access tokens
5. Tokens are encrypted and stored in Supabase
6. Success message shows connected handle

## Project Structure

```
xbanner/
├── app/
│   ├── api/
│   │   ├── x-oauth/          # OAuth endpoints
│   │   └── x-account/        # Account management
│   ├── verification/         # Verification page
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   └── About.tsx
├── lib/
│   ├── encryption.ts      # Token encryption utilities
│   └── supabase.ts          # Supabase client
├── supabase/
│   └── schema.sql           # Database schema
└── package.json
```

## Security Notes

- OAuth tokens are encrypted using AES-256-GCM before storage
- Row Level Security (RLS) is enabled on Supabase tables
- In production, use a proper session store (Redis) instead of cookies for OAuth state
- Always use HTTPS in production
- Keep your `ENCRYPTION_KEY` and `SUPABASE_SERVICE_ROLE_KEY` secret

## Design Principles

The design follows neobrutalism principles:
- Thick black borders (4px on main elements, 2px on navbar)
- Offset box shadows (8px)
- High contrast colors
- Bold typography
- Simple geometric shapes
- Playful, energetic feel
