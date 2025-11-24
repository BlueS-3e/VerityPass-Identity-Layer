/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';

// Mock qrcode dynamic import used by the modal
vi.mock('qrcode', () => {
  return {
    default: {
      toString: async () => '<svg id="test-qr"></svg>',
      toDataURL: async () => 'data:image/png;base64,FAKEPNG',
    }
  };
});

import WalletConnectModal from '../components/WalletConnectModal';

describe('WalletConnectModal', () => {
  it('renders QR and handles copy and cancel (calls provider cleanup)', async () => {
    const mockKill = vi.fn();
    const mockProvider = { connector: { killSession: mockKill } };
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const onCopy = vi.fn();

    // mock clipboard (jsdom may not expose navigator in some test runners)
    if (typeof navigator === 'undefined') global.navigator = {};
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    });

    const { container } = render(
      <WalletConnectModal
        open={true}
        uri={'wc:fake-uri'}
        provider={mockProvider}
        onClose={onClose}
        onCancel={onCancel}
        onCopy={onCopy}
        status={'pending'}
      />
    );

    // Wait for the mocked SVG to be injected
    await waitFor(() => expect(container.querySelector('#test-qr')).toBeTruthy());

    // Click copy button
    const copyBtn = screen.getByText(/Copy URI/i);
    await userEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('wc:fake-uri');

    // Click cancel and expect provider cleanup called and onCancel invoked
    const cancelBtn = screen.getByText(/Cancel Session/i);
    await userEvent.click(cancelBtn);

    expect(mockKill).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
