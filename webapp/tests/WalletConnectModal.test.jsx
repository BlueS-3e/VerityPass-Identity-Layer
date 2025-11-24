/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock qrcode so dynamic import in component resolves fast and predictably
vi.mock('qrcode', () => ({
  default: {
    toString: vi.fn().mockResolvedValue('<svg><text>QR</text></svg>'),
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,FAKE')
  }
}))

import WalletConnectModal from '../src/components/WalletConnectModal.jsx'

describe('WalletConnectModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders QR and calls provider.killSession + onCancel when Cancel clicked', async () => {
    const mockKill = vi.fn()
    const mockProvider = { connector: { killSession: mockKill }, disconnect: vi.fn() }
    const onCancel = vi.fn()

    render(
      <WalletConnectModal
        open={true}
        uri={'wc:fake-uri'}
        provider={mockProvider}
        onCancel={onCancel}
        onClose={() => {}}
        status="pending"
      />
    )

    // Wait for mocked SVG to be inserted
    await waitFor(() => {
      expect(document.querySelector('svg')).toBeTruthy()
    })

    const cancelBtn = screen.getByRole('button', { name: /cancel session/i })
    fireEvent.click(cancelBtn)

    expect(mockKill).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })
})
