import React, { useEffect } from 'react';

/**
 * Modern, clean wallet picker component
 * Shows available wallets with icons, handles selection and connection
 */
export default function WalletPicker({
  wallets = [],
  selectedWallet = null,
  connecting = false,
  error = null,
  onSelectWallet = () => {},
  onConnect = async () => {},
  onClearError = () => {},
  compact = false, // Show fewer wallets (3-4 instead of all)
  excludeIds = [] // Wallet IDs to exclude from display
}) {
  const displayWallets = React.useMemo(() => {
    const filtered = wallets.filter(w => !excludeIds.includes(w.id));
    if (!compact) return filtered;
    
    // Show prioritized wallets first
    const priority = ['MetaMask', 'Coinbase Wallet', 'Rabby Wallet', 'Brave Wallet', 'OKX Wallet', 'WalletConnect'];
    const prioritized = priority
      .map(name => filtered.find(w => w.name === name))
      .filter(Boolean);
    
    return compact ? prioritized.slice(0, 4) : prioritized;
  }, [wallets, compact, excludeIds]);

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <div className="text-red-200 text-sm">{error}</div>
            <button
              onClick={onClearError}
              className="text-xs text-red-300/70 hover:text-red-300 mt-1 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Wallet grid */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {displayWallets.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-400">
            <div className="text-sm">No wallets detected</div>
            <div className="text-xs mt-1">Please install an EVM wallet extension</div>
          </div>
        ) : (
          displayWallets.map((wallet) => {
            const isSelected = selectedWallet?.id === wallet.id;
            const isWalletConnecting = connecting && isSelected;

            return (
              <button
                key={wallet.id}
                onClick={() => !isWalletConnecting && onSelectWallet(wallet)}
                disabled={isWalletConnecting}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-200
                  ${isSelected 
                    ? 'border-amber-400 bg-amber-500/10' 
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }
                  ${isWalletConnecting ? 'opacity-70 cursor-wait' : 'cursor-pointer'}
                  ${compact ? 'p-3' : ''}
                `}
                title={wallet.name}
              >
                {/* Wallet icon */}
                {wallet.icon && (
                  <img 
                    src={wallet.icon} 
                    alt={wallet.name}
                    className={`${compact ? 'w-8 h-8 mx-auto' : 'w-10 h-10 mx-auto'} rounded mb-2`}
                  />
                )}

                {/* Wallet name */}
                <div className={`text-white font-medium text-center ${compact ? 'text-xs' : 'text-sm'}`}>
                  {wallet.name}
                </div>

                {/* Loading indicator */}
                {isWalletConnecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                    <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  </div>
                )}

                {/* Selection checkmark */}
                {isSelected && !isWalletConnecting && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-black text-xs font-bold">
                    ✓
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Selected wallet info & connect button */}
      {selectedWallet && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg mb-4">
            {selectedWallet.icon && (
              <img src={selectedWallet.icon} alt="" className="w-8 h-8 rounded" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{selectedWallet.name}</div>
              <div className="text-xs text-gray-400">Ready to connect</div>
            </div>
          </div>

          <button
            onClick={() => onConnect(selectedWallet)}
            disabled={!selectedWallet || connecting}
            className={`
              w-full py-3 rounded-lg font-medium transition-all duration-200
              flex items-center justify-center gap-2
              ${connecting
                ? 'bg-gray-500/20 text-gray-300 cursor-wait'
                : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:shadow-lg hover:shadow-amber-500/50'
              }
              disabled:opacity-50
            `}
          >
            {connecting ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300/30 border-t-gray-300 rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>🔗</span>
                <span>Connect Wallet</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
