#!/bin/bash
# Pre-build check: ensure Vercel has necessary environment variables

set -e

echo "🔍 Checking build environment..."

# Check if we're in Vercel CI
if [ "$VERCEL" = "1" ]; then
    echo "✓ Running in Vercel CI"
    
    # Check for required env vars
    if [ -z "$VITE_API_BASE" ]; then
        echo "⚠️  WARNING: VITE_API_BASE is not set in Vercel environment variables"
        echo "   The app will attempt to discover the API URL at runtime via /api/frontend-config"
        echo "   If this fails, set VITE_API_BASE in Vercel project settings."
    else
        echo "✓ VITE_API_BASE is set to: ${VITE_API_BASE:0:30}..."
    fi
    
    if [ -z "$VITE_WALLETCONNECT_PROJECT_ID" ]; then
        echo "⚠️  WARNING: VITE_WALLETCONNECT_PROJECT_ID not set - WalletConnect will not work"
    else
        echo "✓ VITE_WALLETCONNECT_PROJECT_ID is set"
    fi
else
    echo "ℹ️  Not running in Vercel (local build)"
fi

echo "✓ Pre-build check complete"
