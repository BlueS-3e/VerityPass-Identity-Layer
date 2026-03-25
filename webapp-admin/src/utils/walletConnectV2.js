import { createWeb3Modal, defaultConfig } from '@web3modal/ethers';

let web3Modal = null;

function parseChainId(chainId) {
  if (chainId === undefined || chainId === null) return null;
  if (typeof chainId === 'number') return chainId;
  if (typeof chainId === 'string') {
    return chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10);
  }
  return null;
}

export async function initWeb3Modal(projectId, options = {}) {
  if (web3Modal) return web3Modal;

  if (!projectId) {
    throw new Error('WalletConnect projectId is required. Set VITE_WALLETCONNECT_PROJECT_ID.');
  }

  const {
    chains = [
      { chainId: 1, name: 'Ethereum', currency: 'ETH', explorerUrl: 'https://etherscan.io', rpcUrl: 'https://eth.llamarpc.com' },
      { chainId: 56, name: 'BSC', currency: 'BNB', explorerUrl: 'https://bscscan.com', rpcUrl: 'https://bsc-dataseed.binance.org' },
      { chainId: 97, name: 'BSC Testnet', currency: 'tBNB', explorerUrl: 'https://testnet.bscscan.com', rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545' },
      { chainId: 137, name: 'Polygon', currency: 'MATIC', explorerUrl: 'https://polygonscan.com', rpcUrl: 'https://polygon-rpc.com' }
    ],
    metadata = {
      name: 'RealMint Admin',
      description: 'Admin wallet login',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://realmint.app',
      icons: ['https://realmint.app/favicon.ico']
    }
  } = options;

  const ethersConfig = defaultConfig({ metadata });

  web3Modal = createWeb3Modal({
    ethersConfig,
    chains,
    projectId,
    enableAnalytics: true,
    allWallets: 'SHOW',
    allowUnsupportedChain: true,
    themeMode: 'dark'
  });

  return web3Modal;
}

export async function connectWithWalletConnect() {
  if (!web3Modal) {
    throw new Error('WalletConnect modal not initialized');
  }

  return new Promise((resolve, reject) => {
    let done = false;
    let unsubscribe = null;
    let modalSeenOpen = false;
    let closeGraceTimer = null;

		const cleanup = () => {
			unsubscribe?.();
			if (closeGraceTimer) {
				clearTimeout(closeGraceTimer);
				closeGraceTimer = null;
			}
		};

		const tryResolveFromProvider = async () => {
			if (done) return false;

			let provider = null;
			try {
				provider = web3Modal.getWalletProvider();
			} catch (e) {
				provider = null;
			}

			if (!provider || typeof provider.request !== 'function') {
				return false;
			}

			let accounts = [];
			let chainIdRaw = null;
			try {
				accounts = await provider.request({ method: 'eth_accounts', params: [] });
			} catch (e) {
				accounts = [];
			}

			if (!Array.isArray(accounts) || accounts.length === 0) {
				return false;
			}

			try {
				chainIdRaw = await provider.request({ method: 'eth_chainId', params: [] });
			} catch (e) {
				chainIdRaw = null;
			}

			done = true;
			clearTimeout(timer);
			cleanup();
			resolve({ provider, address: accounts[0], chainId: parseChainId(chainIdRaw) || 1 });
			return true;
		};

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('WalletConnect timed out before approval was completed'));
    }, 120000);

    unsubscribe = web3Modal.subscribeState(async (state) => {
      if (done) return;

      if (state.open) {
        modalSeenOpen = true;
      }

			if (await tryResolveFromProvider()) {
				return;
			}

      // If the modal has been opened at least once, then closes without a connected
      // address, treat it as user cancellation (after a short grace period).
      if (modalSeenOpen && state.open === false) {
        if (!closeGraceTimer) {
          closeGraceTimer = setTimeout(async () => {
            if (done) return;
            if (await tryResolveFromProvider()) return;
            done = true;
            clearTimeout(timer);
            cleanup();
            reject(new Error('WalletConnect modal was closed before approval'));
          }, 1000);
        }
        return;
      }

      if (closeGraceTimer) {
        clearTimeout(closeGraceTimer);
        closeGraceTimer = null;
      }
    });

    web3Modal.open({ view: 'Connect' });

		(async () => {
			for (let i = 0; i < 240 && !done; i += 1) {
				// 240 * 500ms = 120s max
				// eslint-disable-next-line no-await-in-loop
				await new Promise((r) => setTimeout(r, 500));
				// eslint-disable-next-line no-await-in-loop
				if (await tryResolveFromProvider()) break;
			}
		})();
  });
}
