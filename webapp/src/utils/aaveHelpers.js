import * as ethers from 'ethers';

// Helpers to fetch Aave user data and price oracle info.
// These are best-effort helpers and assume common Aave interfaces.

export async function getUserAccountData(poolAddress, providerOrSigner, userAddress) {
  const poolAbi = [
    'function getUserAccountData(address user) view returns (uint256 totalCollateralBase,uint256 totalDebtBase,uint256 availableBorrowsBase,uint256 currentLiquidationThreshold,uint256 ltv,uint256 healthFactor)'
  ];
  const pool = new ethers.Contract(poolAddress, poolAbi, providerOrSigner);
  return pool.getUserAccountData(userAddress);
}

export async function getAssetPrice(priceOracleAddress, providerOrSigner, asset) {
  const oracleAbi = [
    'function getAssetPrice(address asset) view returns (uint256)'
  ];
  const oracle = new ethers.Contract(priceOracleAddress, oracleAbi, providerOrSigner);
  return oracle.getAssetPrice(asset);
}

// Decide if requested borrow (borrowRaw with borrowDecimals) is within availableBorrowsBase
// price is expected to have 18 decimals (common in Aave deployments). Returns {ok:bool, reason:string}
export function checkBorrowWithinAvailable(availableBorrowsBase, borrowRaw, borrowDecimals, price) {
  try {
    // Convert values to BigInt and perform integer arithmetic.
    const bnAvailable = BigInt(availableBorrowsBase.toString());
    const bnBorrowRaw = BigInt(borrowRaw.toString());
    const bnPrice = BigInt(price.toString());

    // borrowValueBase = borrowRaw * price / (10 ** borrowDecimals)
    const factor = 10n ** BigInt(borrowDecimals);
    const borrowValueBase = (bnBorrowRaw * bnPrice) / factor;

    if (borrowValueBase <= bnAvailable) return { ok: true };
    return { ok: false, reason: 'Requested borrow exceeds available borrow capacity' };
  } catch (e) {
    return { ok: false, reason: 'Unable to evaluate borrow safety' };
  }
}

// Compute projected health factor after adding collateralValueBase and borrowValueBase.
// Assumptions:
// - `totalCollateralBase` and `totalDebtBase` from Aave are in the same base units (wei-like, 18 decimals)
// - `currentLiquidationThreshold` is expressed in basis points (e.g. 8250 => 82.50%).
// These assumptions hold for many Aave deployments; adjust scaling if your target deployment uses different units.
export function computeProjectedHealthFactor(userAccountData, collateralAddedValueBase, borrowAddedValueBase) {
  try {
    // Use BigInt arithmetic for base unit sums.
    const totalCollateralBase = BigInt(userAccountData[0].toString());
    const totalDebtBase = BigInt(userAccountData[1].toString());
    const currentLiquidationThreshold = BigInt(userAccountData[3].toString());

    const newCollateral = totalCollateralBase + BigInt(collateralAddedValueBase.toString());
    const newDebt = totalDebtBase + BigInt(borrowAddedValueBase.toString());

    if (newDebt === 0n) return { healthFactor: Number.POSITIVE_INFINITY };

  // Use ethers v6 formatUnits helper
  const formatUnits = ethers.formatUnits;

    const nf = Number(formatUnits(newCollateral, 18));
    const nd = Number(formatUnits(newDebt, 18));
    const lq = Number(currentLiquidationThreshold.toString()) / 10000.0;

    const hf = (nf * lq) / nd;
    return { healthFactor: hf };
  } catch (e) {
    return { healthFactor: null, error: e.message || String(e) };
  }
}

export default { getUserAccountData, getAssetPrice, checkBorrowWithinAvailable };
