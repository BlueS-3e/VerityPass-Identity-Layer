#!/usr/bin/env node
// Simple CLI to check contract owner() and optionally compare to an expected owner
// Usage:
//   RPC_URL=https://... CONTRACT_ADDR=0x... EXPECTED_OWNER=0x... node scripts/check-owner.js

const { ethers } = require('ethers');

const RPC = process.env.RPC_URL || 'http://localhost:8545';
const CONTRACT = process.env.CONTRACT_ADDR;
const EXPECTED = process.env.EXPECTED_OWNER;

if (!CONTRACT) {
  console.error('Please set CONTRACT_ADDR env var');
  process.exit(2);
}

async function main(){
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = ['function owner() view returns (address)'];
  const c = new ethers.Contract(CONTRACT, abi, provider);
  try{
    const owner = await c.owner();
    console.log('owner:', owner);
    if (EXPECTED) {
      const norm = (s)=> (s||'').toLowerCase();
      if (norm(owner) !== norm(EXPECTED)){
        console.error('owner mismatch: expected', EXPECTED, 'but got', owner);
        process.exit(3);
      } else {
        console.log('owner matches expected');
      }
    }
  }catch(e){
    console.error('failed to read owner()', e);
    process.exit(4);
  }
}

main();
