import * as ethers from 'ethers';

// Minimal ERC20 ABI snippets used by adapters
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)'
];

// Minimal lending adapters for Aave and Compound.
// These are lightweight helpers that build the required transaction data
// for a frontend to prompt the user to approve/send. They deliberately avoid
// making any on-chain calls (no RPC reads) during construction to keep
// behavior deterministic in environments without providers. Callers should
// pass a signer/provider when ready to send txs.

// NOTE: This is scaffolding and should be tested on testnet before production.

export function buildAaveBorrowTx({
  poolAddress, // Aave Pool contract address
  collateralAsset, // ERC20 collateral token
  collateralAmount, // in token units (raw int string)
  borrowAsset, // ERC20 to borrow
  borrowAmount, // raw int string
  interestRateMode = 2, // 1 = stable, 2 = variable
}) {
  // Aave v3 Pool interface snippets
  const iface = new ethers.Interface([
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  ]);

  const zeroAddr = '0x' + '00'.repeat(20);
  const supplyData = iface.encodeFunctionData('supply', [collateralAsset, collateralAmount, zeroAddr, 0]);
  const borrowData = iface.encodeFunctionData('borrow', [borrowAsset, borrowAmount, interestRateMode, 0, zeroAddr]);

  // encode ERC20 approve to allow Pool to pull collateral
  const erc20 = new ethers.Interface(['function approve(address spender, uint256 amount)']);
  const approveData = erc20.encodeFunctionData('approve', [poolAddress, collateralAmount]);

  return {
    protocol: 'aave',
    steps: [
      // approve collateral: encoded approve so frontend can send it
      { to: collateralAsset, data: approveData, note: 'Approve collateral token to Aave Pool' },
      // supply collateral
      { to: poolAddress, data: supplyData, note: 'Supply collateral to Aave Pool' },
      // borrow
      { to: poolAddress, data: borrowData, note: 'Borrow from Aave Pool' },
    ],
  };
}

export function buildCompoundBorrowTx({
  cTokenAddress, // cToken address for collateral or borrow asset
  underlyingAsset, // underlying ERC20 for collateral
  collateralAmount,
  borrowCTokenAddress, // cToken of asset to borrow
  borrowAmount,
}) {
  // cToken interface primes
  const cIface = new ethers.Interface([
    'function mint(uint256 mintAmount) returns (uint256)',
    'function borrow(uint256 borrowAmount) returns (uint256)'
  ]);

  const mintData = cIface.encodeFunctionData('mint', [collateralAmount]);
  const borrowData = cIface.encodeFunctionData('borrow', [borrowAmount]);

  return {
    protocol: 'compound',
    steps: [
      { to: underlyingAsset, data: null, note: 'Approve underlying token to cToken' },
      { to: cTokenAddress, data: mintData, note: 'Mint cTokens (supply collateral)' },
      { to: borrowCTokenAddress, data: borrowData, note: 'Borrow underlying via cToken' },
    ],
  };
}

// Helper to send prepared steps using a signer. Approver steps (data === null)
// are expected to be handled by calling the ERC20 approve flow externally.
export async function executeSteps(signer, steps) {
  const receipts = [];
  for (const s of steps) {
    if (!s.data) {
      receipts.push({ note: s.note, status: 'skipped', reason: 'no-data (approve steps must be handled by caller)' });
      continue;
    }
    const tx = await signer.sendTransaction({ to: s.to, data: s.data });
    const rcpt = await tx.wait();
    receipts.push({ note: s.note, txHash: rcpt.transactionHash, status: 'ok' });
  }
  return receipts;
}

export default { buildAaveBorrowTx, buildCompoundBorrowTx, executeSteps };
