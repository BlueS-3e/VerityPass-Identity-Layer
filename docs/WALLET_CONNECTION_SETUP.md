# Modern Web3 Wallet Connection - Clean Implementation Guide

## Overview
This document describes the new, clean wallet connection system following modern web3 dApp patterns.

## 🎯 Key Improvements

### Before (Old Pattern)
- ❌ Duplicated wallet connection logic across components
- ❌ Complex state management (availableWallets, selectedWallet, connecting, etc.)
- ❌ Premature Web3Modal initialization
- ❌ Inconsistent error handling
- ❌ Mixed concerns (UI, connection, storage)

### After (New Pattern)
- ✅ **Centralized logic** via `useWalletConnection` hook
- ✅ **Clean UI** via `WalletPicker` component
- ✅ **Lazy initialization** - Web3Modal only loads when needed
- ✅ **Consistent errors** - normalized error messages
- ✅ **Single responsibility** - each piece does one thing well

---

## 📦 New Components & Hooks

### 1. `useWalletConnection()` Hook
Location: `/webapp/src/hooks/useWalletConnection.js`

**Purpose:** Centralized wallet connection logic

**Provides:**
- `wallets` - Array of available wallets
- `selectedWallet` - Currently selected wallet
- `address` - Connected account address
- `chainId` - Current network chain ID
- `connecting` - Boolean loading state
- `error` - Current error message
- `initializeWallets()` - Load available wallets
- `selectWallet(wallet)` - Set selected wallet
- `connect(wallet?, options?)` - Connect to wallet
- `disconnect()` - Disconnect current wallet
- `clearError()` - Clear error state

**Example Usage:**
```jsx
const {
  wallets,
  selectedWallet,
  address,
  connecting,
  error,
  initializeWallets,
  selectWallet,
  connect,
  disconnect,
  clearError
} = useWalletConnection();

// On mount
useEffect(() => {
  initializeWallets();
}, [initializeWallets]);

// Connect
const handleConnect = async () => {
  const result = await connect(selectedWallet, {
    fetchBalance: true,
    autoSwitchNetwork: true
  });
  if (result?.address) {
    console.log('Connected:', result.address);
  }
};
```

---

### 2. `WalletPicker` Component
Location: `/webapp/src/components/WalletPicker.jsx`

**Purpose:** Clean, modern wallet selection UI

**Props:**
- `wallets` - Array of available wallets
- `selectedWallet` - Currently selected wallet
- `connecting` - Loading state
- `error` - Error message to display
- `onSelectWallet(wallet)` - Callback when wallet selected
- `onConnect(wallet)` - Callback to connect
- `onClearError()` - Callback to clear error
- `compact` - Show fewer wallets (mobile)
- `excludeIds` - Array of wallet IDs to hide

**Features:**
- Shows wallet icons, names, availability
- Selection state with checkmark
- Loading spinner during connection
- Error display with dismiss button
- Responsive grid layout
- One-click connect flow

**Example Usage:**
```jsx
<WalletPicker
  wallets={wallets}
  selectedWallet={selectedWallet}
  connecting={connecting}
  error={error}
  onSelectWallet={selectWallet}
  onConnect={async (wallet) => {
    const result = await connect(wallet);
    if (result?.address) {
      addToast('Connected!', 'success');
    }
  }}
  onClearError={clearError}
  compact={isMobile}
/>
```

---

## 🔄 Usage Pattern (Modern)

### Step 1: Initialize
```jsx
const { wallets, initializeWallets } = useWalletConnection();

useEffect(() => {
  initializeWallets();
}, [initializeWallets]);
```

### Step 2: Display Picker
```jsx
<WalletPicker
  wallets={wallets}
  selectedWallet={selectedWallet}
  connecting={connecting}
  error={error}
  onSelectWallet={selectWallet}
  onConnect={handleConnect}
  onClearError={clearError}
/>
```

### Step 3: Handle Connection
```jsx
const handleConnect = async (wallet) => {
  const result = await connect(wallet, {
    fetchBalance: true,
    autoSwitchNetwork: true
  });

  if (result?.address) {
    addToast('✅ Wallet connected', 'success');
    // Your success logic
  } else if (error) {
    addToast(`❌ ${error}`, 'error');
  }
};
```

---

## 🎨 UI Pattern (Modern Web3 DApp)

### Connection Flow
1. **Wallet Picker** - User selects wallet
2. **Ready State** - Show selected wallet + "Connect" button
3. **Connecting** - Show loading spinner, disable interactions
4. **Result** - Success or error toast

### Example Layout
```
┌─────────────────────────────┐
│  Available Wallets          │
├─────────────────────────────┤
│ [MetaMask] [Coinbase] [...]│
│ [Rabby]    [Brave]  [...]  │
├─────────────────────────────┤
│  Selected: MetaMask         │
│  [Connect Wallet] (button)  │
├─────────────────────────────┤
│  ✅ Connected: 0x123...789 │
└─────────────────────────────┘
```

---

## 🔧 Refactoring Checklist

### For ConnectPlaid.jsx
- [x] Import `useWalletConnection` hook
- [x] Import `WalletPicker` component
- [x] Replace state: `owner`, `connecting` → Use hook values
- [x] Replace functions: `handleSelectWallet`, `connectWallet` → Use hook
- [x] Replace wallet picker UI → Use `<WalletPicker />`
- [ ] Remove old `useEffect` wallet detection logic (simplified by hook)
- [ ] Remove `prioritizeWalletConnect` helper (built into hook)
- [ ] Test identity binding after connection

### For Launchpad.jsx
Same pattern as ConnectPlaid

### For Attestation.jsx
Same pattern, plus handle session restoration

---

## 📋 Error Handling

The hook normalizes errors to user-friendly messages:

```
Connection Input                  → User Message
─────────────────────────────────────────────────
"cancelled" / "user rejected"    → "Connection cancelled"
"no provider"                     → "[Wallet] not found. Install it."
"timeout"                         → "Connection timeout - retry"
Other                             → Original error message
```

---

## 🚀 Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Code Duplication** | 3x connection logic | 1x hook + 1x component |
| **Error Handling** | Inconsistent | Normalized |
| **Web3Modal Init** | Premature | Lazy (on-demand) |
| **State Management** | Complex | Simple hook values |
| **UI Consistency** | Different per page | Unified component |
| **Mobile Support** | Viewport hack | Real device detection |
| **Network Switching** | Unreliable | Robust with fallback |

---

## 📝 Example: Clean ConnectPlaid with Hook

```jsx
import { useWalletConnection } from './hooks/useWalletConnection';
import WalletPicker from './components/WalletPicker';

export default function ConnectPlaid() {
  const { addToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  
  const {
    wallets,
    selectedWallet,
    address,
    chainId,
    connecting,
    error,
    initializeWallets,
    selectWallet,
    connect,
    disconnect,
    clearError
  } = useWalletConnection();

  useEffect(() => {
    initializeWallets();
  }, [initializeWallets]);

  const handleConnect = async () => {
    const result = await connect(selectedWallet, {
      fetchBalance: false,
      autoSwitchNetwork: true
    });

    if (result?.address) {
      addToast('🎉 Wallet connected', 'success');
      setCurrentStep(1);
    }
  };

  return (
    <div>
      <h1>Connect Your Wallet</h1>
      
      <WalletPicker
        wallets={wallets}
        selectedWallet={selectedWallet}
        connecting={connecting}
        error={error}
        onSelectWallet={selectWallet}
        onConnect={() => handleConnect()}
        onClearError={clearError}
        compact={isMobileDevice()}
      />

      {address && (
        <div>
          <p>Connected: {address}</p>
          <p>Network: {chainId}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 Next Steps

1. **Test the new hook** - Use `useWalletConnection` in a test page
2. **Gradually migrate pages:**
   - ConnectPlaid.jsx
   - Launchpad.jsx
   - Attestation.jsx
3. **Remove old utilities** - Once fully migrated:
   - Delete old `connectWallet` implementations
   - Remove `prioritizeWalletConnect` helpers
   - Clean up duplicate state declarations
4. **Monitor & optimize** - Track connection success rates, error patterns

---

## ✅ Quality Checklist

- [x] No premature Web3Modal initialization
- [x] Wallet selection before connection
- [x] Loading states during connection
- [x] Normalized error messages
- [x] Mobile/desktop responsive
- [x] Session persistence
- [x] Network auto-switching
- [x] Clean separation of concerns

---

This modern pattern provides a clean, maintainable, and user-friendly wallet connection experience!
