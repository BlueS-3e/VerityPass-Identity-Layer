#!/usr/bin/env node
// Lightweight watcher to monitor OwnershipTransferred and fee-related events
// Usage:
//   RPC_URL=https://bsc... CONTRACT_ADDR=0x... WEBHOOK_URL=https://hooks.example.com node scripts/watch-owner.js

const { JsonRpcProvider, Contract } = require('ethers');

const RPC = process.env.RPC_URL || 'http://localhost:8545';
const CONTRACT = process.env.CONTRACT_ADDR;
const WEBHOOK = process.env.WEBHOOK_URL || null;

if (!CONTRACT) {
  console.error('Please set CONTRACT_ADDR env var');
  process.exit(1);
}

const provider = new JsonRpcProvider(RPC);

const ABI = [
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
  'event PlatformFeeUsdCentsUpdated(uint256 newFee)',
  'event Withdrawn(address indexed to, uint256 amount)'
];

const contract = new Contract(CONTRACT, ABI, provider);

async function postWebhook(payload) {
  if (!WEBHOOK) return;
  try {
    if (typeof fetch === 'undefined') {
      // Node <18 fallback: use https request
      const https = require('https');
      const data = JSON.stringify(payload);
      const url = new URL(WEBHOOK);
      const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } };
      const req = https.request(url, opts, (res) => {
        // ignore response
      });
      req.on('error', (e) => { console.error('webhook error', e); });
      req.write(data);
      req.end();
    } else {
      await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
  } catch (e) {
    console.error('Failed to post webhook', e);
  }
}

contract.on('OwnershipTransferred', async (previousOwner, newOwner) => {
  const msg = `OwnershipTransferred: ${previousOwner} -> ${newOwner}`;
  console.log(new Date().toISOString(), msg);
  await postWebhook({ type: 'OwnershipTransferred', previousOwner, newOwner, timestamp: Date.now() });
});

contract.on('PlatformFeeUsdCentsUpdated', async (newFee) => {
  console.log(new Date().toISOString(), 'PlatformFeeUsdCentsUpdated', newFee.toString());
  await postWebhook({ type: 'PlatformFeeUsdCentsUpdated', newFee: newFee.toString(), timestamp: Date.now() });
});

contract.on('Withdrawn', async (to, amount) => {
  console.log(new Date().toISOString(), 'Withdrawn', to, amount.toString());
  await postWebhook({ type: 'Withdrawn', to, amount: amount.toString(), timestamp: Date.now() });
});

console.log('Watching contract', CONTRACT, 'via', RPC);
