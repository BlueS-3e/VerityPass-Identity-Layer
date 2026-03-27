#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const network = hre.network.name || process.env.HARDHAT_NETWORK || 'hardhat';
  console.log('Running deploy on network:', network);

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log('Deployer address:', deployerAddress);
  const bal = await hre.ethers.provider.getBalance(deployerAddress);
  console.log('Deployer balance:', hre.ethers.formatEther(bal));

  // Helper to write deployments
  const outDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const deployments = {};

  const isLocal = network === 'hardhat' || network === 'localhost' || network === 'anvil';
  const DEFAULT_PRICE_FEEDS = {
    sepolia: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
    mainnet: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
  };

  // Price feed address: prefer env, then network-specific default, otherwise deploy a mock
  let priceFeed = process.env.PRICE_FEED_ADDRESS || process.env.PRICE_ORACLE_ADDRESS;
  if (!priceFeed && DEFAULT_PRICE_FEEDS[network] && !isLocal) {
    priceFeed = DEFAULT_PRICE_FEEDS[network];
    console.log(`Using default ${network} price feed:`, priceFeed);
  }
  if (!priceFeed) {
    if (isLocal) {
      console.log('No price feed configured; deploying MockV3Aggregator (local)');
      const Mock = await hre.ethers.getContractFactory('MockV3Aggregator');
      // MockV3Aggregator constructor requires (uint8 decimals, int256 initialAnswer)
      const mock = await Mock.deploy(8, 200000000000);
      await mock.waitForDeployment();
      priceFeed = mock.target;
      console.log('Deployed MockV3Aggregator at', priceFeed);
    } else {
      console.warn('No PRICE_FEED_ADDRESS set; the deployed contract may not operate correctly without a valid feed.');
    }
  }

  // Deploy VerityPassLaunchpad
  console.log('Deploying VerityPassLaunchpad with priceFeed:', priceFeed || '0x0');
  const Launchpad = await hre.ethers.getContractFactory('VerityPassLaunchpad');
  const launchpad = await Launchpad.deploy(priceFeed || hre.ethers.ZeroAddress);
  await launchpad.waitForDeployment();
  console.log('VerityPassLaunchpad deployed at', launchpad.target);

  // Deploy AttestationRegistry
  console.log('Deploying AttestationRegistry...');
  const Registry = await hre.ethers.getContractFactory('AttestationRegistry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log('AttestationRegistry deployed at', registry.target);

  deployments.VerityPassLaunchpad = launchpad.target;
  deployments.AttestationRegistry = registry.target;
  deployments.priceFeed = priceFeed || null;

  // Optionally transfer ownership to a multisig (recommended for production)
  const multisig = process.env.MULTISIG_ADDRESS || process.env.MULTISIG;
  if (multisig && multisig !== '' && multisig.toLowerCase() !== deployerAddress.toLowerCase()) {
    try {
      console.log('Transferring ownership to multisig:', multisig);
      const tx = await launchpad.transferOwnership(multisig);
      console.log('transferOwnership tx hash:', tx.hash);
      await tx.wait();
      console.log('Ownership transferred to', multisig);
      deployments.transferredOwnershipTo = multisig;
    } catch (err) {
      console.warn('Ownership transfer failed or skipped:', err.message ? err.message : err);
    }
  } else {
    console.log('No multisig configured or multisig equals deployer; skipping ownership transfer.');
  }

  // persist deployments to file
  const outPath = path.join(outDir, `${network}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log('Wrote deployments to', outPath);

  // If etherscan / bscscan verification key exists, attempt verification
  const verifyKey = process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY;
  if (verifyKey) {
    try {
      console.log('Attempting contract verification...');
      await hre.run('verify:verify', {
        address: launchpad.target,
        constructorArguments: [priceFeed || hre.ethers.ZeroAddress]
      });
      console.log('Verification finished (if provider supported the network).');
    } catch (err) {
      console.warn('Verification failed or skipped:', err.message ? err.message : err);
    }
  } else {
    console.log('No verification API key provided; skipping verify step.');
  }

  console.log('\nDeployment summary:');
  console.log(JSON.stringify(deployments, null, 2));
}

main().catch((err) => {
  console.error('Deploy script error:', err);
  process.exitCode = 1;
});
