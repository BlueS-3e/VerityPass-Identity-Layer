import React, { useEffect, useState, useRef, useCallback } from 'react';

export default function WalletConnectModal({ 
  open, 
  uri, 
  provider, // optional WalletConnect provider instance for direct cleanup
  onClose, 
  onCopy, 
  onCancel, 
  status = 'pending', 
  title = 'Connect with WalletConnect' 
}) {
  const [svg, setSvg] = useState(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  const deepLinks = [
    { name: 'MetaMask', href: (u) => `https://metamask.app.link/wc?uri=${encodeURIComponent(u)}` },
    { name: 'Trust Wallet', href: (u) => `https://link.trustwallet.com/open?uri=${encodeURIComponent(u)}` },
    { name: 'Coinbase Wallet', href: (u) => `https://go.cb-w.com/wc?uri=${encodeURIComponent(u)}` },
    { name: 'Rainbow', href: (u) => `rainbow://wc?uri=${encodeURIComponent(u)}` }
  ];

  const deepLinkHref = uri ? `wc:${encodeURIComponent(uri)}` : '#';

  const handleCopy = useCallback(async () => {
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      onCopy?.(uri);
    } catch (e) {
      console.debug('Copy failed', e);
    }
  }, [uri, onCopy]);

  const handleCancel = useCallback(() => {
    // Attempt to gracefully kill the WalletConnect session if a provider was supplied
    try {
      if (provider) {
        const conn = provider.connector;
        if (conn && typeof conn.killSession === 'function') {
          try { conn.killSession(); } catch (e) { console.debug('killSession failed', e); }
        } else if (typeof provider.disconnect === 'function') {
          try { provider.disconnect(); } catch (e) { console.debug('provider.disconnect failed', e); }
        }
      }
    } catch (e) {
      console.debug('Provider cleanup error:', e);
    }

    try {
      onCancel?.() || onClose?.();
    } catch (e) {
      console.debug('Cancel error:', e);
    }
  }, [onCancel, onClose, provider]);

  // QR code generation
  useEffect(() => {
    let mounted = true;
    setSvg(null);
    
    if (!open || !uri) return;

    const generateQR = async () => {
      try {
        const mod = await import('qrcode');
        const qrLib = mod.default || mod;

        // Prefer SVG string output when available
        if (typeof qrLib.toString === 'function') {
          const svgString = await qrLib.toString(uri, { type: 'svg', margin: 1, width: 300 });
          if (mounted) setSvg(svgString);
          return;
        }

        // Fallback to a data URL (PNG) if SVG not supported
        if (typeof qrLib.toDataURL === 'function') {
          const dataUrl = await qrLib.toDataURL(uri, { scale: 6 });
          if (mounted) setSvg(`<img src="${dataUrl}" alt="walletconnect-qr" />`);
          return;
        }

        throw new Error('qrcode library does not expose toString or toDataURL');
      } catch (e) {
        console.debug('Failed to generate QR:', e);
      }
    };

    generateQR();

    return () => {
      mounted = false;
    };
  }, [open, uri]);

  // Copy timeout cleanup
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!open) return;

    const node = containerRef.current;
    if (node) {
      const focusableElements = node.querySelectorAll(
        'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      if (firstElement) firstElement.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key === 'Tab' && node) {
        const focusableElements = node.querySelectorAll(
          'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const getStatusContent = () => {
    const statusConfig = {
      pending: { 
        text: 'Waiting for wallet to connect…', 
        icon: <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
      },
      connected: { 
        text: 'Connected — finalizing…', 
        icon: <div className="text-green-500">✓</div> 
      },
      failed: { 
        text: 'Connection failed. Try again.', 
        icon: <div className="text-red-500">✕</div> 
      }
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <div className="flex items-center justify-center gap-3" role="status" aria-live={status === 'pending' ? 'polite' : 'assertive'}>
        <div className="text-center text-sm text-gray-700">
          {config.text}
        </div>
        {config.icon}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
      aria-modal="true" 
      role="dialog" 
      aria-label="WalletConnect"
    >
      <div 
        ref={containerRef} 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 mx-4"
        role="document"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
          <button 
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* QR Code Section */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
            {svg ? (
              <div 
                dangerouslySetInnerHTML={{ __html: svg }}
                className="p-2"
              />
            ) : (
              <div className="text-sm text-gray-500">
                Generating QR…
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
            >
              {copied ? 'Copied!' : 'Copy URI'}
            </button>
            <a 
              href={deepLinkHref}
              className="px-4 py-2 border border-gray-300 hover:border-gray-400 rounded-lg text-slate-700 transition-colors font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in wallet
            </a>
          </div>

          {/* Deep Links */}
          <div className="w-full">
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {deepLinks.map((deepLink) => (
                <a
                  key={deepLink.name}
                  href={deepLink.href(uri)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 border border-gray-200 hover:border-gray-300 rounded-lg text-sm text-slate-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Open in {deepLink.name}
                </a>
              ))}
            </div>

            {/* Status Indicator */}
            {getStatusContent()}

            {/* Cancel Button */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                Cancel Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}