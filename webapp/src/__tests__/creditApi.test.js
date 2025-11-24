import { describe, it, expect, vi } from 'vitest';
import assessCredit from '../utils/creditApi';

describe('creditApi.assessCredit', () => {
  it('posts payload and returns result', async () => {
    const mockResp = { score: 700, offers: [{ id: 'o1', amount: 1000 }] };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockResp });

    const payload = { draft: { verified_income: 50000 }, bank_meta: {}, onchain: {} };
    const res = await assessCredit(payload);

    expect(global.fetch).toHaveBeenCalled();
    expect(res.score).toBe(700);
    expect(res.offers.length).toBe(1);
  });
});
