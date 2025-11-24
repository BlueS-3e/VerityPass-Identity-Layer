import * as web3 from '../web3.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('getAuthoritativeFeeRecipient', () => {
  beforeEach(()=>{
    vi.restoreAllMocks();
  })

  it('returns on-chain owner when available', async () => {
    // mutate the helpers object so the function call inside getAuthoritativeFeeRecipient
    // goes through the mocked implementation
    web3.__web3_helpers.getOnChainOwner = vi.fn().mockResolvedValue('0xAa00000000000000000000000000000000000001')
    const res = await web3.getAuthoritativeFeeRecipient()
    expect(res).toBe('0xAa00000000000000000000000000000000000001')
  })

  it('falls back to PAYMENT_ADDRESS when on-chain not available', async () => {
    web3.__web3_helpers.getOnChainOwner = vi.fn().mockResolvedValue(null)
    const res = await web3.getAuthoritativeFeeRecipient()
    expect(res).toBe(web3.PAYMENT_ADDRESS)
  })
})
