# Zero To Shipped

Docs → [https://documents.zerotoshipped.com](https://documents.zerotoshipped.com/docs/quick-start)  
Demo → https://zts.server.kitze.io  
ENV generator → https://env.zerotoshipped.com/  
 
# ZTS

Personal Sats is a privacy-first, Bitcoin-only portfolio and tax tracker. It helps users manually log trades, calculate capital gains/losses, capture wash sale losses, and get tax-optimized insights — all without linking wallets or exchanges.

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
 
