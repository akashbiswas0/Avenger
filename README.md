# xBanner - Twitter Header Rental Marketplace

A decentralized marketplace platform that allows X (Twitter) users to monetize their profile header space by renting it to advertisers. Built with Next.js 14, featuring automated payments, banner management, and daily verification.

## Overview

xBanner is a Web3 marketplace where:
- **Creators** can list their X profile header space for rent and earn passive income
- **Advertisers** can rent header space, upload ad images, and pay automatically via blockchain
- **Automated system** handles banner updates, daily verification, payments, and refunds

## Features

### Core Functionality

- **X OAuth 2.0 Integration**: Secure connection to X accounts using OAuth 2.0 with PKCE
- **Coinbase CDP Wallet Integration**: Seamless Web3 wallet connection for creators and advertisers
- **x402 Payment Protocol**: Automated USDC payments on Base Sepolia testnet
- **Banner Rental Marketplace**: Browse and rent available header spaces
- **Automated Banner Flipping**: Updates X profile banners via X API v1.1
- **Creator Dashboard**: Manage rental requests, approve/reject ads, track earnings
- **Daily Verification System**: Automated cron job that:
  - Takes screenshots of X profiles
  - Verifies ads are still displayed using image comparison
  - Pays creators daily if ads are verified
  - Automatically refunds advertisers if ads are removed
- **Approval Workflow**: Creators must approve rental requests before banners go live
- **Neobrutalism Design**: Bold, high-contrast UI with geometric shapes and offset shadows

### Technical Features

- **Encrypted Token Storage**: OAuth tokens encrypted with AES-256-GCM before database storage
- **Image Processing**: Uses Sharp for banner image processing and comparison
- **Puppeteer Integration**: Automated screenshot capture for verification
- **Supabase Backend**: PostgreSQL database with Row Level Security (RLS)
- **TypeScript**: Fully typed codebase for better developer experience
- **Responsive Design**: Works on all device sizes

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- X (Twitter) Developer Account
- Coinbase Developer Platform account (for CDP wallet integration)
- Base Sepolia testnet USDC for payments

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the database migrations:
   - Create the initial schema (if you have `supabase/schema.sql`)
   - Run `supabase/migration_rentals_approval.sql` for rental tracking features
3. Get your Supabase credentials from Project Settings > API:
   - Project URL
   - Anon key
   - Service role key

### 3. Set Up X (Twitter) API

1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Create a new OAuth 2.0 app
3. Get your Client ID and Client Secret
4. Set the callback URL to: `http://127.0.0.1:3000/api/x-oauth2/callback` (for local development)
   - Note: Twitter requires `127.0.0.1` instead of `localhost`
5. For banner updates, you'll also need OAuth 1.0a credentials (API Key and API Secret)
   - Note: X v1.1 API (used for banner updates) requires OAuth 1.0a, while OAuth 2.0 is used for account connection

### 4. Set Up Coinbase Developer Platform

1. Create a Coinbase Developer Platform account
2. Create an API key and secret for server-side wallet operations
3. Set up a server wallet address for receiving payments and sending payouts
4. Ensure your server wallet has USDC on Base Sepolia testnet

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# X OAuth 2.0 (for account connection)
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret
X_REDIRECT_URI=http://127.0.0.1:3000/api/x-oauth2/callback

# X OAuth 1.0a (for banner updates - optional, see note below)
X_API_KEY=your_x_api_key
X_API_SECRET=your_x_api_secret

# Encryption
ENCRYPTION_KEY=your_32_byte_hex_key
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Coinbase CDP (for server wallet)
CDP_API_KEY_ID=your_cdp_api_key_id
CDP_API_KEY_SECRET=your_cdp_api_key_secret
CDP_SERVER_WALLET_ADDRESS=your_server_wallet_address

# Application
NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3000

# Cron Job (for Vercel Cron or manual triggers)
CRON_SECRET=your_random_secret_for_cron_authentication
```

**Note on OAuth 1.0a**: The banner update feature requires OAuth 1.0a tokens. If you only have OAuth 2.0 set up, banner updates will not work. You'll need to implement OAuth 1.0a flow separately or use OAuth 1.0a credentials for banner operations.

### 6. Run Database Migrations

Execute the migration file in your Supabase SQL Editor:

```bash
# Run supabase/migration_rentals_approval.sql
```

This creates the necessary columns for:
- Rental approval workflow
- Daily payment tracking
- Verification system
- Refund tracking

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Application Flow

### For Creators (Banner Owners)

1. **Connect X Account**: Visit `/verification` and connect your X account via OAuth 2.0
2. **Connect Wallet**: Connect your Web3 wallet to receive payments
3. **Create Listing**: Go to `/listing` to set your price per day and minimum rental period
4. **Manage Rentals**: Use `/dashboard` to:
   - Approve or reject rental requests
   - View active rentals and earnings
   - Track daily payments

### For Advertisers

1. **Browse Marketplace**: Visit `/marketplace` to see available header spaces
2. **Select Listing**: Click "Rent This Space" on any listing
3. **Upload Ad**: Upload your ad image (max 5MB, PNG/JPG)
4. **Set Duration**: Choose rental duration (minimum set by creator)
5. **Pay & Submit**: Payment is processed automatically via x402 protocol
6. **Wait for Approval**: Creator must approve your rental request
7. **Banner Goes Live**: Once approved, banner is automatically updated on X

### Automated Processes

1. **Daily Verification Cron** (`/api/cron/verify-rentals`):
   - Runs daily (configured in `vercel.json`)
   - Takes screenshots of active rentals
   - Compares current banner with ad image
   - If ad is present: Pays creator daily amount in USDC
   - If ad is removed: Stops payments and refunds remaining days to advertiser

2. **Banner Flipping** (`/api/banner/flip`):
   - Triggered when creator approves a rental
   - Updates X profile banner via X API v1.1
   - Requires OAuth 1.0a tokens

## Database Schema

### Key Tables

#### `x_accounts`
Stores encrypted X OAuth tokens and account information:
- `user_id`: Unique user identifier
- `x_user_id`: X user ID
- `screen_name`: X handle (e.g., @username)
- `encrypted_access_token`: Encrypted OAuth 2.0 access token
- `refresh_token`: Encrypted refresh token (optional)
- `expires_at`: Token expiration timestamp
- `encrypted_token_secret`: Encrypted OAuth 1.0a token secret (if available)

#### `listings`
Stores banner rental listings:
- `id`: Unique listing ID
- `x_user_id`: X user ID of the creator
- `x_account_id`: Reference to x_accounts table
- `screen_name`: X handle
- `wallet_address`: Creator's wallet address for receiving payments
- `price_per_day`: Price in USDC per day
- `min_days`: Minimum rental period in days
- `message`: Optional message to advertisers
- `active`: Whether listing is active

#### `rentals`
Stores rental requests and tracking:
- `id`: Unique rental ID
- `listing_id`: Reference to listings table
- `advertiser_wallet_address`: Advertiser's wallet address
- `ad_image_url`: Base64 or URL of ad image
- `ad_image_hash`: SHA-256 hash of ad image for verification
- `duration_days`: Rental duration
- `total_price`: Total payment amount
- `payment_tx_hash`: Initial payment transaction hash
- `payment_status`: 'paid' | 'pending' | 'failed'
- `approval_status`: 'pending' | 'approved' | 'rejected'
- `status`: 'pending' | 'active' | 'rejected' | 'completed' | 'failed'
- `days_paid`: Number of days paid so far
- `last_verification_date`: Last verification timestamp
- `verification_failed`: Boolean flag if ad was removed
- `refund_amount`: Amount refunded to advertiser
- `refund_tx_hash`: Refund transaction hash
- `started_at`: When rental actually started (after approval)
- `current_banner_url`: Current banner URL on X

## API Endpoints

### Authentication & Account Management

- `GET /api/x-oauth2/authorize` - Initiates X OAuth 2.0 flow
- `GET /api/x-oauth2/callback` - OAuth callback handler
- `GET /api/x-account/check` - Check if X account is connected
- `POST /api/x-account/disconnect` - Disconnect X account

### Rentals & Payments

- `POST /api/rentals/create` - Create rental request (requires x402 payment)
- `POST /api/rentals/approve` - Approve or reject rental (creator only)
- `POST /api/banner/flip` - Update X profile banner with ad image

### Automation

- `GET /api/cron/verify-rentals` - Daily verification cron job
  - Requires `Authorization: Bearer {CRON_SECRET}` header
  - Can be triggered manually or via Vercel Cron

## Project Structure

```
xbanner/
├── app/
│   ├── api/
│   │   ├── banner/
│   │   │   └── flip/              # Banner update endpoint
│   │   ├── cron/
│   │   │   └── verify-rentals/    # Daily verification cron
│   │   ├── rentals/
│   │   │   ├── create/            # Create rental (with payment)
│   │   │   └── approve/           # Approve/reject rental
│   │   ├── x-account/
│   │   │   ├── check/             # Check account connection
│   │   │   └── disconnect/       # Disconnect account
│   │   └── x-oauth2/
│   │       ├── authorize/         # OAuth 2.0 initiation
│   │       └── callback/          # OAuth 2.0 callback
│   ├── dashboard/                 # Creator dashboard
│   ├── listing/                   # Create listing page
│   ├── marketplace/                # Browse listings
│   ├── rent/
│   │   └── [listingId]/           # Rent header space
│   ├── verification/              # Connect X account
│   ├── cdp-provider.tsx          # CDP wallet provider
│   ├── layout.tsx
│   ├── page.tsx                  # Landing page
│   └── globals.css
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── About.tsx
│   └── WalletConnection.tsx
├── lib/
│   ├── encryption.ts             # AES-256-GCM encryption
│   ├── supabase.ts               # Supabase client
│   └── oauth-state-store.ts      # OAuth state management
├── supabase/
│   └── migration_rentals_approval.sql
├── vercel.json                    # Vercel Cron configuration
├── package.json
└── README.md
```

## Payment System

### x402 Protocol

The application uses the x402 payment protocol for automated USDC payments:

- **Payment Flow**:
  1. Advertiser requests rental via `/api/rentals/create`
  2. Server returns `402 Payment Required` with payment requirements
  3. Client (using `useX402` hook) automatically processes payment
  4. Payment is sent to server wallet on Base Sepolia
  5. Server verifies payment and creates rental record

- **Daily Payouts**:
  - Server wallet sends daily USDC payments to creators
  - Uses Coinbase CDP SDK for transaction signing
  - USDC contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)

- **Refunds**:
  - If verification fails (ad removed), remaining days are refunded
  - Refund sent automatically to advertiser's wallet

## Verification System

The daily verification cron job:

1. **Screenshot Capture**: Uses Puppeteer to capture X profile pages
2. **Banner Extraction**: Extracts top 20% of screenshot (banner area)
3. **Image Comparison**: Uses perceptual hashing to compare current banner with ad image
4. **Decision**:
   - If similar: Pay creator daily amount
   - If different: Mark as failed, refund advertiser

### Image Comparison Algorithm

- Resizes both images to 300x300px
- Converts to greyscale
- Calculates perceptual hash (average pixel threshold)
- Computes Hamming distance
- Threshold: 10% difference allowed (for compression/rendering variations)

## Security

- **Token Encryption**: OAuth tokens encrypted with AES-256-GCM before storage
- **Row Level Security**: Supabase RLS enabled on all tables
- **OAuth State**: CSRF protection via state parameter and PKCE
- **Payment Verification**: x402 protocol handles payment verification
- **Cron Authentication**: Cron endpoints protected with secret token
- **HTTPS Required**: Always use HTTPS in production

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

The `vercel.json` file configures the daily cron job:
- Runs at midnight UTC (`0 0 * * *`)
- Calls `/api/cron/verify-rentals`

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:
- Supabase credentials
- X OAuth credentials
- CDP API keys
- Encryption key
- Cron secret
- Base URL (production domain)

## Design Principles

The UI follows neobrutalism design principles:
- **Thick Borders**: 4px black borders on main elements, 2px on navbar
- **Offset Shadows**: 8px box shadows with offset
- **High Contrast**: Bold color contrasts
- **Bold Typography**: Strong, readable fonts
- **Geometric Shapes**: Simple, clean shapes
- **Playful Feel**: Energetic and engaging design

## Known Limitations

1. **OAuth 1.0a Requirement**: Banner updates require OAuth 1.0a tokens. If you only have OAuth 2.0, banner updates will not work. You'll need to implement OAuth 1.0a flow separately.

2. **Testnet Only**: Currently configured for Base Sepolia testnet. For mainnet, update:
   - USDC contract address
   - Network identifier in CDP SDK calls
   - Base URL for transaction explorers

3. **Image Storage**: Ad images are currently stored as base64 in the database. For production, consider using Supabase Storage or IPFS.

4. **Screenshot Reliability**: Puppeteer screenshots may fail if X changes their UI. Consider implementing retry logic or alternative verification methods.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license here]

## Support

For issues, questions, or contributions, please open an issue on GitHub.
