#!/bin/bash
# Quick production deployment helper
# This script generates the environment variables needed for production deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 RealMint Production Deployment Setup"
echo "======================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if mainnet contract address is provided
if [ -z "$1" ]; then
  echo -e "${YELLOW}Usage: $0 <mainnet-launchpad-address>${NC}"
  echo ""
  echo "Example:"
  echo "  $0 0x1234567890abcdef1234567890abcdef12345678"
  echo ""
  exit 1
fi

MAINNET_ADDRESS="$1"

# Validate address format
if ! [[ "$MAINNET_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
  echo -e "${RED}✗ Invalid Ethereum address format${NC}"
  exit 1
fi

echo -e "${BLUE}Contract Address: $MAINNET_ADDRESS${NC}"
echo ""

# Generate environment files
echo "📝 Generating environment configuration files..."
echo ""

# Create webapp .env
cat > "$PROJECT_ROOT/webapp/.env.production" << EOF
# Production environment - Webapp
VITE_NETWORK=mainnet
VITE_RPC_URL_MAINNET=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
VITE_LAUNCHPAD_ADDRESS=$MAINNET_ADDRESS
VITE_CHAIN_ID=1
VITE_API_BASE=https://your-api-domain.onrender.com
VITE_FEATURE_WALLETLESS=false
VITE_SENTRY_DSN=
EOF

echo -e "${GREEN}✓${NC} Created: webapp/.env.production"

# Create webapp-admin .env
cat > "$PROJECT_ROOT/webapp-admin/.env.production" << EOF
# Production environment - Webapp Admin
VITE_NETWORK=mainnet
VITE_RPC_URL_MAINNET=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
VITE_LAUNCHPAD_ADDRESS=$MAINNET_ADDRESS
VITE_CHAIN_ID=1
VITE_API_BASE=https://your-api-domain.onrender.com
VITE_SENTRY_DSN=
EOF

echo -e "${GREEN}✓${NC} Created: webapp-admin/.env.production"

# Create API .env
cat > "$PROJECT_ROOT/api/.env.production" << EOF
# Production environment - API
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=GENERATE_A_RANDOM_32_CHAR_STRING

# Blockchain
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
LAUNCHPAD_ADDRESS=$MAINNET_ADDRESS
PRICE_FEED_ADDRESS=0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419

# Database & Cache
DATABASE_URL=postgresql://user:pass@host:5432/realmint_prod
REDIS_URL=redis://user:pass@host:6379

# Session
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=Lax
SESSION_LIFETIME_SECONDS=604800

# CORS
CORS_ORIGINS=https://your-domain.com,https://admin.your-domain.com

# Plaid
PLAID_CLIENT_ID=YOUR_PLAID_CLIENT_ID
PLAID_SECRET=YOUR_PLAID_SECRET
PLAID_ENVIRONMENT=production

# Monitoring
SENTRY_DSN=
LOG_LEVEL=INFO

# Etherscan (for verification, not critical in production)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
EOF

echo -e "${GREEN}✓${NC} Created: api/.env.production"

echo ""
echo "📋 NEXT STEPS:"
echo "============="
echo ""
echo "1. Update all .env.production files with real values:"
echo "   - Infura/Alchemy API keys"
echo "   - Database URLs (from Render)"
echo "   - Plaid credentials"
echo "   - Domain names"
echo ""
echo "2. Add environment variables to Render:"
echo "   ${BLUE}cat api/.env.production | pbcopy${NC}  # macOS"
echo "   ${BLUE}cat api/.env.production | xclip -selection clipboard${NC}  # Linux"
echo ""
echo "3. Add environment variables to Vercel:"
echo "   Dashboard → Settings → Environment Variables"
echo ""
echo "4. Push to GitHub:"
echo "   ${BLUE}git add webapp/.env.production webapp-admin/.env.production api/.env.production${NC}"
echo "   ${BLUE}git commit -m \"chore: add production environment files\"${NC}"
echo "   ${BLUE}git push origin main${NC}"
echo ""
echo "5. Deploy:"
echo "   - Render auto-deploys on push"
echo "   - Vercel auto-deploys on push"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
