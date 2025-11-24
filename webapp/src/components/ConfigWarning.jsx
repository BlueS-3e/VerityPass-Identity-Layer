import React, { useState, useEffect } from 'react';

export default function ConfigWarning({ storageKey = 'config-warning-dismissed', title, message, ctaText, ctaHref }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === '1') setDismissed(true);
    } catch (e) {}
  }, [storageKey]);

  const close = () => {
    try { window.localStorage.setItem(storageKey, '1'); } catch (e) {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="w-full p-3 rounded border-l-4 border-yellow-400 bg-yellow-900/40 text-yellow-100 flex items-start justify-between gap-4">
      <div className="flex-1">
        {title && <div className="font-semibold">{title}</div>}
        <div className="text-sm mt-1">{message}</div>
        {ctaText && ctaHref && (
          <div className="mt-2">
            <a href={ctaHref} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 bg-yellow-700 text-black rounded">{ctaText}</a>
          </div>
        )}
      </div>
      <div>
        <button onClick={close} className="px-3 py-1 bg-transparent border border-yellow-600 rounded text-yellow-200">Dismiss</button>
      </div>
    </div>
  );
}
