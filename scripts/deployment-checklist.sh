#!/bin/bash
# Production deployment checklist script

set -e

echo "🚀 VerityPass dApp Production Deployment Checklist"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
  echo -e "${YELLOW}?${NC} $1"
  read -p "  Confirm (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✓${NC} Confirmed"
  else
    echo -e "${RED}✗${NC} Not confirmed - exiting"
    exit 1
  fi
}

echo "📋 PRE-DEPLOYMENT CHECKS"
echo "========================"
echo ""

check "1. Contract deployed to mainnet and verified on Etherscan"
check "2. Mainnet RPC URL (Infura/Alchemy) is working"
check "3. All environment variables prepared in .env.production.example"
check "4. Plaid integration credentials ready"
check "5. Custom domain DNS records updated (if using custom domain)"
check "6. Database backups enabled on Render"

echo ""
echo "🔧 DEPLOYMENT STEPS"
echo "==================="
echo ""

echo "1. Deploy API to Render:"
echo "   - Push to GitHub"
echo "   - Render auto-deploys"
echo "   - Wait for deployment to complete"
echo "   - Run: curl https://your-render-url.onrender.com/health"
echo ""

check "API deployment complete and health check passes"

echo ""
echo "2. Deploy Webapp to Vercel:"
echo "   - Create new Vercel project"
echo "   - Set Root Directory: webapp"
echo "   - Add environment variables"
echo "   - Deploy"
echo ""

check "Webapp deployed and loads without errors"

echo ""
echo "3. Deploy Webapp-Admin to Vercel:"
echo "   - Create new Vercel project"
echo "   - Set Root Directory: webapp-admin"
echo "   - Add environment variables"
echo "   - Deploy"
echo ""

check "Webapp-Admin deployed and loads"

echo ""
echo "✅ POST-DEPLOYMENT VERIFICATION"
echo "==============================="
echo ""

check "4. Wallet connection works (test with MetaMask)"
check "5. Network selector shows mainnet (chain ID 1)"
check "6. API calls succeed (check Network tab in DevTools)"
check "7. Attestation flow works end-to-end"
check "8. Admin dashboard accessible and functional"

echo ""
echo "📊 MONITORING SETUP"
echo "==================="
echo ""

check "9. Sentry connected and receiving errors"
check "10. Prometheus metrics accessible"
check "11. Database connection verified in Render logs"
check "12. Redis connection verified (if applicable)"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📝 Next steps:"
echo "   - Monitor error logs in Sentry"
echo "   - Watch API response times"
echo "   - Test critical user flows"
echo "   - Set up monitoring alerts"
echo ""
