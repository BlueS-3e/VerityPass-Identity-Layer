#!/usr/bin/env node
// Simple E2E helper: sign a legacy-style attestation payload with a generated wallet,
// POST to API `/api/attestations/pin`, and (optionally) publish on-chain if contract address provided.

const { ethers } = require('ethers');
const axios = require('axios');

async function run() {
  const API_BASE = process.env.API_BASE || 'http://localhost:5000';
  const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const provider = new ethers.JsonRpcProvider(RPC);

  // Create a test wallet (or use HARDHAT_NETWORK_ACCOUNT env to specify)
  const wallet = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, provider) : ethers.Wallet.createRandom().connect(provider);
  console.log('Using wallet', wallet.address);

  // Build attestation fields
  const subject = wallet.address;
  const schemaHash = ethers.hexlify(ethers.randomBytes(32));
  const dataCID = `ipfs://${ethers.hexlify(ethers.randomBytes(12)).slice(2)}`;
  const expiresAt = Math.floor(Date.now()/1000) + 60*60; // 1 hour
  const contractAddress = process.env.ATTESTATION_CONTRACT || ethers.ZeroAddress;

  // Solidity keccak of (address, bytes32, string, uint256, address)
  const types = ['address','bytes32','string','uint256','address'];
  const values = [subject, schemaHash, dataCID, expiresAt, contractAddress];
  // solidityPacked + keccak256 -> equivalent of solidityKeccak256
  const hash = ethers.keccak256(ethers.solidityPacked(types, values));

  // Sign the hash as an Ethereum signed message
  const sig = await wallet.signMessage(ethers.getBytes(hash));

  const payload = {
    issuer: wallet.address,
    subject,
    schemaHash,
    dataCID,
    expiresAt,
    signature: sig,
    contractAddress
  };

  console.log('Posting to', `${API_BASE}/api/attestations/pin`);
  const resp = await axios.post(`${API_BASE}/api/attestations/pin`, payload).catch(e => { console.error('API error', e.response ? e.response.data : e.message); process.exit(2); });
  console.log('Pin response:', resp.data);

  if (resp.data && resp.data.call_payload && process.env.PUBLISH === '1') {
    const call = resp.data.call_payload;
    // Publish on-chain using local provider and wallet
    if (!process.env.PRIVATE_KEY) {
      console.log('No PRIVATE_KEY provided; skipping on-chain publish.');
      return;
    }
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const attAbi = ["function publishAttestationTyped(address subject, bytes32 schemaHash, string dataCID, uint256 expiresAt, bytes signature) returns (uint256)"];
    const contractAddr = process.env.ATTESTATION_CONTRACT || contractAddress;
    const contract = new ethers.Contract(contractAddr, attAbi, signer);
    console.log('Publishing attestation to', contractAddr);
    const tx = await contract.publishAttestationTyped(call.subject, call.schemaHash, call.dataCID.replace(/^ipfs:\/\//,''), call.expiresAt, call.signature);
    console.log('Publish tx:', tx.hash);
    await tx.wait();
    console.log('Published on-chain');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
