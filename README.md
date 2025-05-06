# Zero To Shipped

Docs → [https://documents.zerotoshipped.com](https://documents.zerotoshipped.com/docs/quick-start)  
Demo → https://zts.server.kitze.io  
ENV generator → https://env.zerotoshipped.com/  
 
# ZTS

Personal Sats is a privacy-first, Bitcoin-only portfolio and tax tracker. It helps users manually log trades, calculate capital gains/losses, capture wash sale losses, and get tax-optimized insights — all without linking wallets or exchanges.

## Security Architecture

### Client-Side Encryption
Personal Sats uses a client-side encryption model to ensure maximum privacy:
- All sensitive transaction data is encrypted in the browser before being sent to the server
- Each user has a unique encryption salt stored in the database
- The encryption key is derived from the user's passphrase and salt using PBKDF2
- The server never sees or handles unencrypted data
- All encryption/decryption operations happen in the browser

### API Contract
The API endpoints expect and return both encrypted and decrypted data:
- `encryptedData`: The encrypted payload containing all sensitive fields
- Decrypted fields: Individual fields are stored unencrypted for querying and display
- The server never performs encryption/decryption operations

### Migration
For existing users, a migration script is provided to generate and store encryption salts:
```bash
# Generate salts for all users
npm run migrate:salts
```

## Environment Variables

### Bitcoin Price Settings
```env
# Duration in milliseconds to cache Bitcoin price data (default: 300000 - 5 minutes)
NEXT_PUBLIC_PRICE_CACHE_DURATION=300000

# Interval in milliseconds to update Bitcoin price (default: 60000 - 1 minute)
NEXT_PUBLIC_PRICE_UPDATE_INTERVAL=60000

# Enable price alert notifications (default: false)
NEXT_PUBLIC_ENABLE_PRICE_ALERTS=false

# Optional API Keys (for authenticated endpoints)
COINBASE_API_KEY=your_key_here
COINBASE_API_SECRET=your_secret_here
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here
KRAKEN_API_KEY=your_key_here
KRAKEN_API_SECRET=your_secret_here
```

These environment variables are validated using Zod schemas and properly separated between client-side and server-side usage. All client-side variables are prefixed with `NEXT_PUBLIC_` and can be accessed in the browser.
 
