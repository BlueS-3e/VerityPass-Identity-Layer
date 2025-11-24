// Simple credit scoring heuristics and lending term generator
// Keep deterministic and safe for frontend usage only.

export async function calculateRiskScore({ incomeAttestations, onChainHistory, repaymentData, bankData }) {
  // More robust scoring using available inputs. All fields are optional.
  // - incomeAttestations: draftInfo (may contain verified_income/income or schema data)
  // - onChainHistory: { txCount, balance } where balance is in ETH (string or number)
  // - repaymentData: { onTimePayments, missedPayments, repaidAmount }
  // - bankData: Plaid-style object e.g. { balances: { available, current }, transactionsCount, avgMonthlyInflow, accountAgeDays }

  let score = 350; // slightly higher base, keep conservative

  // 1) Income attestations and declared income
  try {
    if (incomeAttestations) {
      const declared = Number(incomeAttestations?.verified_income || incomeAttestations?.income || incomeAttestations?.annual_income || 0) || 0;
      if (declared > 0) {
        // logarithmic scaling for income
        score += Math.min(350, Math.floor(Math.log10(declared + 1) * 60));
      } else {
        // small boost for having any attestation record
        score += 40;
      }
    }
  } catch (e) {}

  // 2) Bank account signals (from Plaid metadata if available)
  try {
    const avail = Number(bankData?.balances?.available ?? bankData?.balances?.current ?? bankData?.balance ?? 0) || 0;
    const txCount = Number(bankData?.transactionsCount ?? bankData?.tx_count ?? 0) || 0;
    const inflow = Number(bankData?.avgMonthlyInflow ?? 0) || 0;
    const accountAge = Number(bankData?.accountAgeDays ?? bankData?.account_age_days ?? 0) || 0;

    if (avail > 0) score += Math.min(300, Math.floor(Math.log10(avail + 1) * 70));
    if (inflow > 0) score += Math.min(200, Math.floor(Math.log10(inflow + 1) * 50));
    if (txCount > 0) score += Math.min(120, Math.floor(Math.log10(txCount + 1) * 40));
    if (accountAge > 30) score += Math.min(80, Math.floor(Math.log10(accountAge + 1) * 10));
  } catch (e) {}

  // 3) On-chain signals: balance and activity
  try {
    const chainTx = Number(onChainHistory?.txCount ?? onChainHistory?.tx_count ?? 0) || 0;
    const chainBal = Number(onChainHistory?.balance ?? onChainHistory?.ethBalance ?? 0) || 0;
    if (chainTx > 0) score += Math.min(120, chainTx * 2);
    if (chainBal > 0) score += Math.min(200, Math.floor(Math.log10(chainBal + 1) * 80));
  } catch (e) {}

  // 4) Repayment history (strong signal)
  try {
    const rep = repaymentData || {};
    const onTime = Number(rep?.onTimePayments ?? rep?.on_time_payments ?? 0) || 0;
    const missed = Number(rep?.missedPayments ?? rep?.missed_payments ?? 0) || 0;
    const repaidAmount = Number(rep?.repaidAmount ?? rep?.amount_repaid ?? 0) || 0;
    if (onTime > 0) score += Math.min(300, onTime * 12);
    if (repaidAmount > 0) score += Math.min(250, Math.floor(Math.log10(repaidAmount + 1) * 60));
    if (missed > 0) score -= Math.min(400, missed * 40);
  } catch (e) {}

  // 5) Keep score within sensible bounds
  score = Math.max(0, Math.min(1000, Math.round(score)));
  return score;
}

export async function generateLendingTerms(score) {
  // Given a 0..1000 score produce a small set of lending offers.
  // More score -> lower interest, larger amounts, lower collateral
  const offers = [];
  const tiers = [250, 500, 750];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    // base amount scales with score
    const baseAmount = Math.round((score / 1000) * (10000 * (i + 1)));
    const interest = Math.max(3, Math.round(15 - (score / 1000) * 12) + i * 2); // percent
    const collateralPct = Math.max(50, 150 - Math.round((score / 1000) * 120) - i * 10); // percent
    const loan = {
      id: `offer-${i}-${Date.now()}`,
      amount: baseAmount || (500 * (i + 1)),
      interestRate: interest,
      term: 30 * (i + 1),
      collateralRequired: Math.round(((baseAmount || (500 * (i + 1))) * collateralPct) / 100),
      collateralPct,
    };
    offers.push(loan);
  }

  return offers;
}
