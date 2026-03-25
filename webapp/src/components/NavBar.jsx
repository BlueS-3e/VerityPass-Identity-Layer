import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useModal } from './ModalProvider';
import { getSelectedFlow } from '../flowGate';

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const MENU_WIDTH = 256;

  // Modal context to open SPA modals (ModalProvider wraps the app)
  let openModal = null;
  try { openModal = useModal()?.openModal; } catch (e) { openModal = null; }

  const ENABLE_LAUNCHPAD = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_LAUNCHPAD) !== 'false';
  // Allow several truthy values for easier local enabling (true, 1, yes)
  const ENABLE_AAVE_DEMO = (() => {
    try {
      const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_AAVE_DEMO);
      if (v == null) return false;
      const s = String(v).toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    } catch (e) {
      return false;
    }
  })();

  // Read selected flow from localStorage
  useEffect(() => {
    const readFlow = () => {
      try { 
        setSelectedFlow(getSelectedFlow()); 
      } catch (e) { 
        setSelectedFlow(null); 
      }
    };
    
    readFlow();
    const handleStorage = (ev) => { 
      if (ev.key === 'selected_flow') readFlow(); 
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? 'hidden' : prevOverflow || '';
    return () => { document.body.style.overflow = prevOverflow || ''; };
  }, [menuOpen]);

  // Touch handlers for mobile swipe-to-close
  const handleTouchStart = (e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setTouchStartX(x);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e) => {
    if (touchStartX == null) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = x - touchStartX;
    // For a right-side slide-out menu: dragging left (negative delta) moves the menu toward closed
    setTouchDeltaX(delta < 0 ? Math.max(delta, -MENU_WIDTH) : 0);
  };

  const handleTouchEnd = () => {
    // If the user swiped left far enough, close the menu
    if (Math.abs(touchDeltaX) > Math.floor(MENU_WIDTH / 3)) setMenuOpen(false);
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  // Accessibility: trap focus inside the menu and close on Escape
  const menuRef = useRef(null);
  const closeButtonRef = useRef(null);
  const menuButtonRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (e.key === 'Tab' && menuRef.current) {
        const nodes = menuRef.current.querySelectorAll('a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])');
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
    // focus close button
    setTimeout(() => closeButtonRef.current?.focus(), 40);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Restore focus to menu button when menu closes
  useEffect(() => {
    if (menuOpen) return;
    // small timeout to allow menu close animation to finish
    const t = setTimeout(() => {
      try { menuButtonRef.current?.focus(); } catch (e) {}
    }, 120);
    return () => clearTimeout(t);
  }, [menuOpen]);

  const isActivePath = (path) => location.pathname === path;
  const isHome = isActivePath('/');
  const isLaunch = isActivePath('/launch');
  const isAttest = isActivePath('/attestation');
  const isGuide = isActivePath('/guide');

  // Fixed mobile navigation handler
  const handleMobileNavigation = (to, isAaveDemo = false) => {
    try { 
      setMenuOpen(false); 
    } catch (e) {}
    
    // Small delay to ensure menu is closed before navigation
    setTimeout(() => {
      if (isAaveDemo && typeof openModal === 'function') {
        openModal('aave-demo');
      } else {
        navigate(to);
      }
    }, 50);
  };

  // Helper to render an array of nav items to avoid duplicating JSX for desktop/mobile
  const renderNavItems = (mobile = false) => {
    const items = [
      { 
        key: 'launch', 
        to: '/launch', 
        label: 'Lending Desk', 
        show: ENABLE_LAUNCHPAD && selectedFlow !== 'attestation' && (!mobile || !isLaunch),
        isActive: isLaunch
      },
      { 
        key: 'attest', 
        to: '/attestation', 
        label: mobile ? 'Attestation Workspace' : 'Attest', 
        show: selectedFlow !== 'launchpad' && (!mobile || !isAttest),
        isActive: isAttest
      },
      { 
        key: 'guide', 
        to: '/guide', 
        label: mobile ? 'Playbook & Help' : 'Playbook', 
        show: true,
        isActive: isGuide
      },
      { 
        key: 'aave', 
        to: '/aave-demo', 
        label: 'Aave Demo', 
        show: ENABLE_AAVE_DEMO,
        isActive: false
      },
    ];

    if (mobile) {
      const aaveItem = items.find(it => it.key === 'aave');
      if (aaveItem) aaveItem.show = true;
    }

    return items.filter(i => i.show).map(i => {
      // For mobile, use consistent button approach for all items
      if (mobile) {
        const isActive = i.isActive;
        const isAave = i.key === 'aave';
        const baseClasses = `flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-base font-semibold transition-all w-full text-left border ${
          isAave
            ? 'bg-gradient-to-r from-cyan-400/20 to-blue-400/20 text-cyan-100 border-cyan-300/45 hover:brightness-110 shadow-[0_10px_34px_rgba(34,211,238,0.25)]'
            : isActive
              ? 'bg-amber-400/15 text-amber-200 border-amber-300/40 shadow-[0_10px_30px_rgba(245,158,11,0.2)]'
              : 'text-slate-200 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border-white/10'
        }`;
        
        return (
          <button
            key={i.key}
            type="button"
            className={baseClasses}
            onClick={() => handleMobileNavigation(i.to, i.key === 'aave')}
          >
            <span className="flex items-center gap-2">
              {isAave && <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />}
              {i.label}
            </span>
            <span className={`text-xs ${isAave ? 'text-cyan-200' : 'text-slate-400'}`}>Open</span>
          </button>
        );
      }

      // Desktop - use Link components
      const isActive = i.isActive;
      const isAave = i.key === 'aave';
      const baseClasses = `flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
        isAave
          ? 'border-cyan-300/40 text-cyan-100 bg-cyan-400/10 hover:bg-cyan-400/18 shadow-[0_8px_24px_rgba(34,211,238,0.18)]'
          : isActive
            ? 'bg-indigo-500/20 text-indigo-300 border-transparent shadow-lg'
            : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent'
      }`;

      return (
        <Link
          key={i.key}
          to={i.to}
          className={baseClasses}
          onClick={() => { if (menuOpen) setMenuOpen(false); }}
        >
          {isAave && <span className="inline-block h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.85)]" />}
          {i.label}
        </Link>
      );
    });
  };

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-105 transition-transform bank-pulse">
                <img src="/bnb-chain-logo.svg" alt="BNB Chain" className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">RealMint</div>
                <div className="text-xs text-gray-400 -mt-1">BNB Credit Infrastructure</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {renderNavItems(false)}
            </nav>

            {/* Mobile Menu Button */}
            <button
              ref={menuButtonRef}
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden relative w-11 h-11 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
            >
              <span className="sr-only">Toggle menu</span>
              <span
                className={`absolute left-3 right-3 h-0.5 bg-white rounded-full transition-all duration-300 ${
                  menuOpen ? 'top-5 rotate-45' : 'top-3.5'
                }`}
              />
              <span
                className={`absolute left-3 right-3 h-0.5 bg-white rounded-full transition-all duration-300 ${
                  menuOpen ? 'opacity-0 top-5' : 'top-5 opacity-100'
                }`}
              />
              <span
                className={`absolute left-3 right-3 h-0.5 bg-white rounded-full transition-all duration-300 ${
                  menuOpen ? 'top-5 -rotate-45' : 'top-6.5'
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            onClick={() => setMenuOpen(false)}
          />
          
          {/* Slide-out Menu */}
          <nav
            id="mobile-nav-drawer"
            className="absolute top-0 right-0 h-full w-[88vw] max-w-sm bg-[radial-gradient(circle_at_top,#1f2937_0%,#0f172a_55%,#020617_100%)] backdrop-blur-2xl border-l border-white/10 shadow-2xl"
            role="dialog"
            aria-modal="true"
            ref={menuRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            style={{
              transform: `translateX(${touchDeltaX}px)`,
              transition: touchStartX ? 'none' : 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 9999
            }}
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white shadow-lg shrink-0">
                  <img src="/bnb-chain-logo.svg" alt="BNB Chain" className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-white font-bold text-lg leading-tight">RealMint</div>
                  <div className="text-slate-400 text-sm truncate">BNB Lending Interface</div>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                onClick={() => setMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/10"
                aria-label="Close menu"
              >
                Close
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Network</span>
                <span className="text-xs font-medium text-emerald-100">BNB Smart Chain</span>
              </div>
            </div>

            {/* Mobile Navigation Links */}
            <div className="p-5 space-y-3">
              {renderNavItems(true)}
            </div>

            <div className="px-5">
              <button
                type="button"
                onClick={() => handleMobileNavigation('/connect')}
                className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_14px_34px_rgba(245,158,11,0.3)] hover:brightness-105 transition"
              >
                Connect Identity Signal
              </button>
            </div>

      {/* Aave demo is exposed via the menu items above */}

            {/* Additional Info Section */}
            <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/10 bg-slate-950/70">
              <div className="text-xs text-slate-400 text-center">
                RealMint v1.0 • Secure credit primitives on BNB
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Spacer for fixed header */}
      <div className="h-16" />
    </>
  );
}