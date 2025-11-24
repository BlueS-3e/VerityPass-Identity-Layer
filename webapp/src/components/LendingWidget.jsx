import React, { useState } from 'react';
import { buildAaveBorrowTx, buildCompoundBorrowTx, executeSteps, ERC20_ABI } from '../utils/lendingAdapters';
import { getUserAccountData, getAssetPrice, checkBorrowWithinAvailable, computeProjectedHealthFactor } from '../utils/aaveHelpers';
import * as ethers from 'ethers';
import apiClient from '../utils/apiClient';

export default function LendingWidget({ provider }) {
  // Widget currently supports Aave flow only in the demo
  const [protocol] = useState('aave');
  const [collateralAmount, setCollateralAmount] = useState('0');
  const [borrowAmount, setBorrowAmount] = useState('0');
  const [collateralAddr, setCollateralAddr] = useState('');
  const [borrowAddr, setBorrowAddr] = useState('');
  const [status, setStatus] = useState(null);

  const propose = async () => {
    if (!provider) return setStatus({ error: 'No provider' });
    const signer = provider.getSigner ? provider.getSigner() : provider;

    try {
      if (protocol === 'aave') {
        // Fetch runtime frontend config so operators can change addresses without
        // requiring a frontend rebuild. Prefer server-provided values but fall
        // back to build-time Vite env vars for local dev.
        const cfg = await apiClient.apiGet('/api/frontend-config').catch(() => null);
        const poolAddress = (cfg && cfg.aave_pool_address) || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AAVE_POOL_ADDRESS) || '';
        const priceOracle = (cfg && cfg.aave_price_oracle) || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AAVE_PRICE_ORACLE) || '';

        // require that the Aave pool address is configured for the demo
        if (!poolAddress) {
          setStatus({ error: 'Aave pool address not configured. The backend can provide it via /api/frontend-config (aave_pool_address).' });
          return;
        }

        // validate token addresses provided by the user before instantiating contracts
        try {
          // will throw if invalid
          ethers.getAddress(collateralAddr);
          ethers.getAddress(borrowAddr);
        } catch (e) {
          setStatus({ error: 'Please enter valid ERC20 token addresses for collateral and borrow asset.' });
          return;
        }

        // fetch decimals for tokens to convert human input into raw int
        const collateralContract = new ethers.Contract(collateralAddr, ERC20_ABI, signer.provider || signer);
        const borrowContract = new ethers.Contract(borrowAddr, ERC20_ABI, signer.provider || signer);
        const [cdec, bdec] = await Promise.all([
          collateralContract.decimals().catch(() => 18),
          borrowContract.decimals().catch(() => 18),
        ]);

  const collateralRaw = ethers.parseUnits(collateralAmount || '0', cdec).toString();
  const borrowRaw = ethers.parseUnits(borrowAmount || '0', bdec).toString();

        let plan = buildAaveBorrowTx({ poolAddress, collateralAsset: collateralAddr, collateralAmount: collateralRaw, borrowAsset: borrowAddr, borrowAmount: borrowRaw });

        try {
          // check allowance: if allowance >= collateralRaw, skip approve step
          const userAddress = await signer.getAddress();
          // allowance may throw synchronously (invalid args) or reject the promise; handle both
          let allowance = 0n;
          try {
            const a = await collateralContract.allowance(userAddress, poolAddress);
            // normalize possible return types (BigNumber, bigint, string)
            allowance = BigInt(a?.toString ? a.toString() : a || 0);
          } catch (e) {
            allowance = 0n;
          }

          if (allowance && BigInt(allowance) >= BigInt(collateralRaw)) {
            // filter out approve step (encoded to collateralAddr)
            plan = { ...plan, steps: plan.steps.filter((s) => !(s.to && s.to.toLowerCase() === collateralAddr.toLowerCase() && s.note && s.note.toLowerCase().includes('approve')) ) };
            setStatus({ plan, note: 'Approve not required (sufficient allowance)' });
          } else {
            setStatus({ plan });
          }

          // Perform an Aave safety check if config present
          if (poolAddress && priceOracle) {
            try {
              const userData = await getUserAccountData(poolAddress, signer.provider || signer, userAddress);
              const availableBorrowsBase = userData[2];
              const price = await getAssetPrice(priceOracle, signer.provider || signer, borrowAddr);
              const safety = checkBorrowWithinAvailable(availableBorrowsBase, borrowRaw, bdec, price);
              if (!safety.ok) {
                setStatus({ error: `Unsafe borrow: ${safety.reason}`, plan });
                return;
              }

              // compute projected health factor if the user supplies this collateral and borrows the requested amount
              // Need collateral value in base (e.g., ETH-quoted base). We'll approximate collateralAddedValueBase by using collateralRaw * priceCollateral.
              const collateralPrice = await getAssetPrice(priceOracle, signer.provider || signer, collateralAddr).catch(() => null);
              if (collateralPrice) {
                // collateralRaw is in token units with cdec decimals; convert to base value: collateralRaw * collateralPrice / (10 ** cdec)
                const collateralValueBase = (BigInt(collateralRaw) * BigInt(collateralPrice.toString())) / (10n ** BigInt(cdec));
                const borrowValueBase = (BigInt(borrowRaw) * BigInt(price.toString())) / (10n ** BigInt(bdec));
                const proj = computeProjectedHealthFactor(userData, collateralValueBase, borrowValueBase);
                if (proj && proj.healthFactor !== null) {
                  // warn if projected health factor is low (< 1.3) or below 1
                  const hf = proj.healthFactor;
                  const warn = hf < 1.3 ? (hf < 1 ? 'danger' : 'warning') : 'ok';
                  setStatus((s) => ({ ...s, plan, projectedHealthFactor: hf, healthWarning: warn }));
                }
              }
            } catch (e) {
              // if safety check fails unexpectedly, continue but note inability to fully validate
              console.warn('Aave safety check failed', e);
            }
          }
        } catch (e) {
          // on any error, fall back to original plan (will include approve)
          setStatus({ plan });
        }
      } else {
  const ct = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_COMPOUND_CTOKEN) || '';
        const plan = buildCompoundBorrowTx({ cTokenAddress: ct, underlyingAsset: collateralAddr, collateralAmount, borrowCTokenAddress: ct, borrowAmount });
        setStatus({ plan });
      }
    } catch (e) {
      setStatus({ error: e.message || String(e) });
    }
  };

  const execute = async () => {
    if (!provider) return setStatus({ error: 'No signer/provider available' });
    const signer = provider.getSigner ? provider.getSigner() : provider;
    const steps = status?.plan?.steps || [];

    // Basic safety check: ensure there is at least one approve/supply/borrow step
    if (!steps.length) return setStatus({ error: 'No steps to execute' });

    setStatus((s) => ({ ...s, executing: true }));
    try {
      const receipts = await executeSteps(signer, steps);
      setStatus({ executed: receipts });
    } catch (e) {
      setStatus({ error: e.message || String(e) });
    }
  };

  return (
    <div className="bg-white/5 p-4 rounded">
      <h4 className="text-white mb-2">Lending Widget</h4>
      <div className="space-y-2">
        {/* Protocol is fixed to Aave for the demo */}
        <div>
          <label className="text-sm text-gray-300">Collateral Address</label>
          <input value={collateralAddr} onChange={(e)=>setCollateralAddr(e.target.value)} className="w-full p-2 rounded bg-white/5" />
        </div>
        <div>
          <label className="text-sm text-gray-300">Collateral Amount</label>
          <input value={collateralAmount} onChange={(e)=>setCollateralAmount(e.target.value)} placeholder="e.g. 100.0" className="w-full p-2 rounded bg-white/5" />
        </div>
        <div>
          <label className="text-sm text-gray-300">Borrow Asset Address</label>
          <input value={borrowAddr} onChange={(e)=>setBorrowAddr(e.target.value)} className="w-full p-2 rounded bg-white/5" />
        </div>
        <div>
          <label className="text-sm text-gray-300">Borrow Amount</label>
          <input value={borrowAmount} onChange={(e)=>setBorrowAmount(e.target.value)} placeholder="e.g. 50.0" className="w-full p-2 rounded bg-white/5" />
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={propose} className="px-3 py-2 bg-indigo-600 text-white rounded">Propose Loan</button>
          <button
            onClick={execute}
            className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            disabled={!status || !status.plan || status.healthWarning === 'danger'}
          >
            Execute
          </button>
        </div>
        {status && status.plan && (
          <div className="mt-3 text-sm text-gray-200">
            <div className="font-medium">Planned Steps:</div>
            <ol className="list-decimal list-inside">
              {status.plan.steps.map((s, idx) => (
                <li key={idx} className="mt-1">{s.note} — to: <code className="text-xs">{s.to}</code></li>
              ))}
            </ol>
          </div>
        )}

        {status && typeof status.projectedHealthFactor !== 'undefined' && (
          <div className="mt-3">
            <div className="text-sm font-medium">Projected Health Factor</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${status.healthWarning === 'danger' ? 'bg-red-600 text-white' : status.healthWarning === 'warning' ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white'}`}
              >
                {isFinite(status.projectedHealthFactor) ? status.projectedHealthFactor.toFixed(2) : '∞'}
              </span>
              <span className="text-xs text-gray-300">
                {status.healthWarning === 'danger' && 'Projected health factor is below 1. Borrow would likely be liquidated — execution disabled.'}
                {status.healthWarning === 'warning' && 'Projected health factor is low (<1.3). Consider adding more collateral or borrowing less.'}
                {status.healthWarning === 'ok' && 'Projected health factor looks healthy.'}
              </span>
            </div>
          </div>
        )}
        {status && status.executed && (
          <div className="mt-3 text-sm text-gray-200">Executed: <pre className="text-xs">{JSON.stringify(status.executed, null, 2)}</pre></div>
        )}
        {status && status.error && (
          <div className="mt-3 text-red-400">Error: {status.error}</div>
        )}
      </div>
    </div>
  );
}
