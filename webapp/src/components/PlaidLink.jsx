import React, { useEffect, useState, useRef } from 'react';
import apiClient from '../utils/apiClient';

function loadPlaidScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    if (window.Plaid) return resolve(window.Plaid);
    const id = 'plaid-link-js';
    if (document.getElementById(id)) {
      const check = setInterval(() => { 
        if (window.Plaid) { 
          clearInterval(check); 
          resolve(window.Plaid); 
        } 
      }, 100);
      const timeoutId = setTimeout(() => { 
        clearInterval(check); 
        reject(new Error('Plaid load timeout')); 
      }, 10000);
      if (window.Plaid) {
        clearInterval(check);
        clearTimeout(timeoutId);
        return resolve(window.Plaid);
      }
      return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    s.async = true;
    s.onload = () => { 
      if (window.Plaid) resolve(window.Plaid); 
      else reject(new Error('Plaid loaded but window.Plaid missing')); 
    };
    s.onerror = (e) => reject(e || new Error('Plaid script failed to load'));
    document.head.appendChild(s);
  });
}

function StatusMessage({ type, children }) {
  const statusColors = {
    success: 'bg-green-500/10 border-green-500/30 text-green-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300'
  };

  return (
    <div className={`p-3 rounded-xl border ${statusColors[type]} flex items-center gap-3`}>
      <span className="text-lg">
        {type === 'success' && '✅'}
        {type === 'error' && '❌'}
        {type === 'warning' && '⚠️'}
        {type === 'info' && 'ℹ️'}
      </span>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export default function PlaidLink({ ownerAddr = null, onSuccess = null }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  useEffect(() => {
    async function fetchToken() {
      const controller = new AbortController();
      abortRef.current = controller;
      setFetchingToken(true);
      try {
        try {
          const data = await apiClient.apiPost('/api/connect/plaid/create_link_token', { owner_addr: ownerAddr }, { signal: controller.signal });
          if (mountedRef.current) {
            setLinkToken(data.link_token);
            setMessage('');
          }
        } catch (e) {
          if (mountedRef.current) {
            setMessage((e && e.payload && e.payload.error) ? String(e.payload.error) : 'Failed to create secure connection');
            setMessageType('error');
          }
          return;
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (mountedRef.current) {
          setMessage('Failed to contact server for secure connection');
          setMessageType('error');
        }
      } finally {
        if (mountedRef.current) setFetchingToken(false);
      }
    }
    
    fetchToken();
    
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, [ownerAddr]);

  async function handleOpen() {
    if (!linkToken) { 
      if (mountedRef.current) {
        setMessage('Secure connection not available');
        setMessageType('error');
      }
      return; 
    }
    
    if (mountedRef.current) setLoading(true);
    
    try {
      await loadPlaidScript();
      const plaid = window.Plaid.create({
        token: linkToken,
        onSuccess: async (public_token, metadata) => {
          try {
            const account_id = (metadata && (metadata.account_id || 
              (metadata.accounts && metadata.accounts[0] && metadata.accounts[0].id))) || null;
            
            const data = await apiClient.apiPost('/api/connect/plaid/exchange_public_token', { public_token, account_id, owner_addr: ownerAddr });
            if (mountedRef.current) {
              setMessage('🎉 Bank account connected successfully!');
              setMessageType('success');
            }
            try {
              if (onSuccess && typeof onSuccess === 'function') {
                onSuccess({ public_token, metadata, serverResponse: data });
              }
            } catch (callbackError) {
              console.debug('Plaid success callback error:', callbackError);
            }
          } catch (error) {
            if (error.name !== 'AbortError' && mountedRef.current) {
              setMessage('Connection request failed');
              setMessageType('error');
            }
          } finally {
            if (mountedRef.current) setLoading(false);
          }
        },
        onExit: (error, metadata) => {
          if (error && mountedRef.current) {
            setMessage('Connection was cancelled');
            setMessageType('warning');
          }
          if (mountedRef.current) setLoading(false);
        },
        onEvent: (eventName, metadata) => {
              if (eventName === 'OPEN' && mountedRef.current) {
                setMessage('🔗 Opening secure connection...');
                setMessageType('info');
              }
            }
      });
      
      plaid.open();
    } catch (error) {
      if (mountedRef.current) {
        setMessage(`Failed to initialize secure connection: ${error.message}`);
        setMessageType('error');
        setLoading(false);
      }
    }
  }

  const getButtonState = () => {
    if (fetchingToken) return { text: '🔄 Preparing secure connection...', disabled: true };
    if (loading) return { text: '🔄 Opening secure connection...', disabled: true };
    if (!linkToken) return { text: '⏳ Connection unavailable', disabled: true };
    return { text: '🏦 Connect Bank Account', disabled: false };
  };

  const buttonState = getButtonState();

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-green-500/30 flex items-center justify-center">
          <span className="text-xl">🏦</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Secure Bank Connection</h3>
          <p className="text-gray-300 text-sm">Powered by Plaid • Bank-level security</p>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">🔒</span>
            <div>
              <div className="text-white font-semibold mb-1">Your Data is Protected</div>
              <div className="text-gray-300 text-sm">
                Connect your bank account to verify income and transactions. 
                Your banking credentials are never stored — Plaid handles authentication 
                securely and we only receive tokens to access account information.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div className="mb-6">
          <StatusMessage type={messageType}>
            {message}
          </StatusMessage>
        </div>
      )}

      {/* Connection Button */}
      <div className="space-y-4">
        <button 
          onClick={handleOpen}
          disabled={buttonState.disabled}
          className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
        >
          {fetchingToken && (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          <span>{buttonState.text}</span>
        </button>

        {/* Security Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="text-lg mb-1">🔐</div>
            <div className="text-white text-sm font-medium">Encrypted</div>
            <div className="text-gray-400 text-xs">Bank-level security</div>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="text-lg mb-1">🚫</div>
            <div className="text-white text-sm font-medium">No Storage</div>
            <div className="text-gray-400 text-xs">Credentials never saved</div>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="text-lg mb-1">⚡</div>
            <div className="text-white text-sm font-medium">Instant</div>
            <div className="text-gray-400 text-xs">Quick verification</div>
          </div>
        </div>

        {/* Support Info */}
        <div className="text-center">
          <div className="text-gray-400 text-sm">
            💡 Having trouble? Check popup blockers and ensure JavaScript is enabled
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="text-center p-6 bg-white/10 rounded-xl border border-white/20">
            <div className="w-12 h-12 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-white font-semibold">Opening Secure Connection</div>
            <div className="text-gray-300 text-sm mt-1">You will be redirected to Plaid</div>
          </div>
        </div>
      )}
    </div>
  );
}