import { describe, it, expect } from 'vitest'
import { calculateRiskScore, generateLendingTerms } from '../utils/creditEngine'

describe('creditEngine.calculateRiskScore', () => {
  it('scores bank-only input', async () => {
    const bankData = { balances: { available: 5000, current: 5200 }, transactionsCount: 120, avgMonthlyInflow: 2000, accountAgeDays: 400 }
    const score = await calculateRiskScore({ incomeAttestations: null, onChainHistory: null, repaymentData: null, bankData })
    expect(typeof score).toBe('number')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1000)
  })

  it('scores onchain-only input', async () => {
    const onChain = { txCount: 50, balance: 3.5 }
    const score = await calculateRiskScore({ incomeAttestations: null, onChainHistory: onChain, repaymentData: null, bankData: null })
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1000)
  })

  it('scores repayment history positively and penalizes missed payments', async () => {
    const repaymentGood = { onTimePayments: 5, missedPayments: 0, repaidAmount: 2000 }
    const repaymentBad = { onTimePayments: 0, missedPayments: 2, repaidAmount: 0 }
    const scoreGood = await calculateRiskScore({ incomeAttestations: null, onChainHistory: null, repaymentData: repaymentGood, bankData: null })
    const scoreBad = await calculateRiskScore({ incomeAttestations: null, onChainHistory: null, repaymentData: repaymentBad, bankData: null })
    expect(scoreGood).toBeGreaterThan(scoreBad)
  })

  it('generateLendingTerms returns offers', async () => {
    const offers = await generateLendingTerms(650)
    expect(Array.isArray(offers)).toBe(true)
    expect(offers.length).toBeGreaterThan(0)
    offers.forEach(o => {
      expect(o).toHaveProperty('amount')
      expect(o).toHaveProperty('interestRate')
      expect(o).toHaveProperty('collateralRequired')
    })
  })
})
