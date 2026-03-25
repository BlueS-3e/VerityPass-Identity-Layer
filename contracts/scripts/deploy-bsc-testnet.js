#!/usr/bin/env node
/*
 * Convenience launcher for BNB Chain testnet deployments.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-bsc-testnet.js --network bscTestnet
 */
if (!process.env.HARDHAT_NETWORK) {
  process.env.HARDHAT_NETWORK = 'bscTestnet';
}

require('./deploy.js');
