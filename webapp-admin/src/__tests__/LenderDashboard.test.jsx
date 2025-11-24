/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

// Integrate jest-dom matchers with Vitest's expect
expect.extend(matchers);
import LenderDashboard from '../LenderDashboard';

// Provide a minimal config stub used by the component
vi.mock('../config', () => ({ API_BASE: 'http://localhost:5000' }));

describe('LenderDashboard', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn((url, opts) => {
      if (url.endsWith('/api/admin/attestations/summary')) {
        return Promise.resolve(new Response(JSON.stringify({ total: 1, verified: 1, unverified: 0, recent: [] }), { status: 200 }));
      }
      if (url.startsWith('http://localhost:5000/api/admin/attestations?')) {
        const body = { total: 1, page: 1, per_page: 25, items: [{ id: 42, issuer: '0xAAA', subject: '0xBBB', verified: true, created_at: Math.floor(Date.now()/1000), last_assessment: { score: 720 } }] };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
      if (url.endsWith('/api/admin/attestations/42/detail')) {
        const body = { id: 42, issuer: '0xAAA', subject: '0xBBB', verified: true, created_at: Math.floor(Date.now()/1000), assessments: [{ score: 720, offers: [], created_at: Math.floor(Date.now()/1000) }] };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
      // export endpoints
      if (url.startsWith('http://localhost:5000/api/admin/attestations/export')) {
        const csv = 'id,issuer,subject,score\n42,0xAAA,0xBBB,720\n';
        return Promise.resolve(new Response(csv, { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('renders and fetches list and summary', async () => {
    render(<LenderDashboard />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/admin/attestations/summary', expect.any(Object));
  // header may include total in parentheses; check presence of heading
  expect(screen.getByText(/All Attestations/i)).toBeInTheDocument();
    // row should appear
    await waitFor(() => screen.getByText('0xAAA'));
    expect(screen.getByText('0xAAA')).toBeInTheDocument();
    expect(screen.getByText('720')).toBeInTheDocument();
  });

  it('exports selected by calling detail endpoints', async () => {
    render(<LenderDashboard />);
    await waitFor(() => screen.getByText('0xAAA'));
    // select checkbox
    const checkbox = screen.getAllByRole('checkbox')[1]; // first is header
    fireEvent.click(checkbox);
    // mock URL.createObjectURL and link click
    const orig = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob://x');
    // spy on anchor click by mocking createElement
    const origCreate = document.createElement;
    const clickMock = vi.fn();
    document.createElement = (tag) => {
      if (tag === 'a') return { href: '', download: '', click: clickMock, remove: () => {}, setAttribute: () => {} };
      return origCreate(tag);
    };

    const exportBtns = screen.getAllByRole('button', { name: /Export Selected/i });
    const exportBtn = exportBtns[0];
    fireEvent.click(exportBtn);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/admin/attestations/42/detail', expect.any(Object)));

    // restore
    URL.createObjectURL = orig;
    document.createElement = origCreate;
  });
});
