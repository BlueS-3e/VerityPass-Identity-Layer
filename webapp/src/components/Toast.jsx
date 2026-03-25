import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let idCounter = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, { type = 'info', duration = 5000 } = {}) => {
    const id = idCounter++;
    setToasts((t) => [...t, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const bgColor = t.type === 'error' ? 'bg-red-600 border border-red-500/40' 
            : t.type === 'success' ? 'bg-green-600 border border-green-500/40' 
            : t.type === 'warning' ? 'bg-yellow-600 border border-yellow-500/40'
            : 'bg-blue-600 border border-blue-500/40';
          
          return (
            <div key={t.id} className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg text-sm text-white ${bgColor} backdrop-blur-sm animate-slide-in`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg mt-0.5">
                    {t.type === 'error' && '❌'}
                    {t.type === 'success' && '✅'}
                    {t.type === 'warning' && '⚠️'}
                    {t.type === 'info' && 'ℹ️'}
                  </span>
                  <span className="flex-1">{t.message}</span>
                </div>
                <button onClick={() => removeToast(t.id)} className="text-xs opacity-70 hover:opacity-100 flex-shrink-0">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
