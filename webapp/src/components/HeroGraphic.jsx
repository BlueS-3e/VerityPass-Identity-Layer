import React, { useEffect, useState } from 'react';

export default function HeroGraphic({ className = '', compactOnMobile = true }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!compactOnMobile) return undefined;
    // respect reduced-motion preference
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) return undefined;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const should = window.scrollY > 64 && window.innerWidth <= 640;
        setCollapsed(should);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      try { document.documentElement.removeAttribute('data-hero-collapsed'); } catch (e) {}
    };
  }, [compactOnMobile]);

  useEffect(() => {
    // keep a small global hook so layout/CTA can respond to collapsed state
    try {
      if (collapsed) document.documentElement.setAttribute('data-hero-collapsed', 'true');
      else document.documentElement.removeAttribute('data-hero-collapsed');
    } catch (e) {}
  }, [collapsed]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden -z-10 ${collapsed ? 'hero--collapsed' : ''} ${className}`} aria-hidden="true" role="img">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-zinc-900 to-amber-950 opacity-90" />

      <div className="absolute inset-0 pointer-events-none hero-vignette" aria-hidden="true" />

      <svg className="absolute -top-10 right-8 w-[30rem] h-[18rem] opacity-35 hidden md:block" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true">
        <defs>
          <linearGradient id="loanCard" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="ledger" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

        <rect x="180" y="58" width="320" height="210" rx="18" fill="url(#loanCard)" />
        <rect x="205" y="92" width="160" height="14" rx="7" fill="#1f2937" fillOpacity="0.35" />
        <rect x="205" y="118" width="220" height="10" rx="5" fill="#1f2937" fillOpacity="0.25" />
        <rect x="205" y="136" width="180" height="10" rx="5" fill="#1f2937" fillOpacity="0.2" />
        <rect x="205" y="176" width="55" height="62" rx="8" fill="#1f2937" fillOpacity="0.2" />
        <rect x="270" y="162" width="55" height="76" rx="8" fill="#1f2937" fillOpacity="0.3" />
        <rect x="335" y="146" width="55" height="92" rx="8" fill="#1f2937" fillOpacity="0.42" />
        <path d="M410 226 C440 200 456 198 482 176" stroke="url(#ledger)" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="482" cy="176" r="8" fill="#34d399" />
      </svg>

      <svg className="absolute left-10 bottom-10 w-[26rem] h-[18rem] opacity-30 hidden md:block" viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true">
        <defs>
          <linearGradient id="bankFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.65" />
          </linearGradient>
        </defs>
        <polygon points="120,110 320,40 520,110" fill="#fbbf24" fillOpacity="0.7" />
        <rect x="130" y="110" width="380" height="30" rx="4" fill="#f3f4f6" fillOpacity="0.8" />
        <rect x="150" y="140" width="340" height="170" rx="8" fill="url(#bankFace)" />
        <rect x="200" y="170" width="34" height="110" rx="6" fill="#374151" fillOpacity="0.75" />
        <rect x="250" y="170" width="34" height="110" rx="6" fill="#374151" fillOpacity="0.75" />
        <rect x="300" y="170" width="34" height="110" rx="6" fill="#374151" fillOpacity="0.75" />
        <rect x="350" y="170" width="34" height="110" rx="6" fill="#374151" fillOpacity="0.75" />
        <rect x="400" y="170" width="34" height="110" rx="6" fill="#374151" fillOpacity="0.75" />
        <rect x="120" y="320" width="400" height="18" rx="4" fill="#fbbf24" fillOpacity="0.65" />
      </svg>

      <div className="floating-dots" aria-hidden="true">
        <span className="floating-dot dot-1" />
        <span className="floating-dot dot-2" />
        <span className="floating-dot dot-3" />
        <span className="floating-dot dot-4" />
        <span className="floating-dot dot-5" />
      </div>
    </div>
  );
}
