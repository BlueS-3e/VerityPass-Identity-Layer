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
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-600 via-sky-500 to-teal-700 opacity-60 animate-gradient-x" />

      <div className="absolute inset-0 pointer-events-none hero-vignette" aria-hidden="true" />

  {/* decorative cloud blobs */}
  <svg className="absolute -top-12 left-1/4 w-96 h-48 opacity-18 hidden md:block transform-gpu hero-cloud" viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true">
        <defs>
          <linearGradient id="cloudG" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#bbf7d0" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <g>
          <ellipse cx="200" cy="80" rx="180" ry="60" fill="url(#cloudG)" />
          <ellipse cx="420" cy="60" rx="140" ry="45" fill="url(#cloudG)" />
        </g>
      </svg>

  {/* subtle floating dots — decorative only */}
      <div className="floating-dots" aria-hidden="true">
        <span className="floating-dot dot-1" />
        <span className="floating-dot dot-2" />
        <span className="floating-dot dot-3" />
        <span className="floating-dot dot-4" />
        <span className="floating-dot dot-5" />
        <span className="floating-dot dot-6" />
        <span className="floating-dot dot-7" />
        <span className="floating-dot dot-8" />
      </div>

  {/* animated waves at the bottom */}
  <div className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none h-32 sm:h-40 md:h-48 wave-container">
        <svg className="block w-[200%] h-full wave wave--one" viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="seaG" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#0ea5a4" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
          </defs>
          <path fill="url(#seaG)" fillOpacity="0.95" d="M0,160 C360,200 720,120 1440,160 L1440,320 L0,320 Z" />
        </svg>

        <svg className="block w-[200%] h-full wave wave--two opacity-80" viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" role="presentation" aria-hidden="true">
          <path fill="#0369a1" fillOpacity="0.6" d="M0,140 C360,100 720,220 1440,140 L1440,320 L0,320 Z" />
        </svg>
      </div>
    </div>
  );
}
