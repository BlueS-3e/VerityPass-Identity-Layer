import React, { useRef, useEffect } from 'react';
import { preloadWalletConnect } from '../utils/providerDetect';

export default function ProviderPicker({ visible, wallets = [], onSelect, onClose }) {
  const containerRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    try { preloadWalletConnect().catch(() => {}); } catch (e) { }
    setTimeout(() => closeBtnRef.current?.focus(), 40);

    const onKey = (e) => {
      if (e.key === 'Escape') return onClose && onClose();
      if (e.key === 'Tab' && containerRef.current) {
        const nodes = containerRef.current.querySelectorAll('a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])');
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div ref={containerRef} className="relative z-50 w-full h-full sm:h-auto sm:max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-lg">👛</span>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white">Connect Wallet</h3>
              <p className="text-gray-300 text-xs sm:text-sm">Choose your preferred wallet</p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/10"
            aria-label="Close wallet selector"
          >
            ✕
          </button>
        </div>

        {/* Wallet List */}
        <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto p-4 space-y-3">
          {wallets.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-white font-semibold mb-2">No Wallets Found</div>
              <div className="text-gray-300 text-sm">
                Please install a Web3 wallet like MetaMask or Coinbase Wallet
              </div>
            </div>
          ) : (
            wallets.map(wallet => (
              <button
                key={wallet.id}
                onClick={() => onSelect(wallet)}
                className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  {wallet.icon ? (
                    <img 
                      src={wallet.icon} 
                      alt={`${wallet.name} icon`}
                      className="w-10 h-10 rounded-xl bg-white/10 p-1.5"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <span className="text-lg">🔗</span>
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-white font-semibold group-hover:text-indigo-300 transition-colors">
                      {wallet.name || 'Unknown Wallet'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {wallet.type === 'injected' ? 'Browser Wallet' : 'Web3 Provider'}
                    </div>
                  </div>
                </div>
                <div className="text-gray-400 group-hover:text-indigo-300 transition-colors">
                  →
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-4 border-t border-white/10 bg-white/5">
          <div className="text-center text-gray-400 text-sm">
            🔒 Your wallet connection is secure and private
          </div>
        </div>
      </div>
    </div>
  );
}