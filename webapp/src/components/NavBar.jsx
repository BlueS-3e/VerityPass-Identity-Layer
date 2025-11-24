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
        icon: '⭐', 
        label: 'Launchpad', 
        show: ENABLE_LAUNCHPAD && selectedFlow !== 'attestation' && (!mobile || !isLaunch),
        isActive: isLaunch
      },
      { 
        key: 'attest', 
        to: '/attestation', 
        icon: '📝', 
        label: mobile ? 'Create Attestation' : 'Attest', 
        show: selectedFlow !== 'launchpad' && (!mobile || !isAttest),
        isActive: isAttest
      },
      { 
        key: 'guide', 
        to: '/guide', 
        icon: '📚', 
        label: mobile ? 'Guides & Help' : 'Guides', 
        show: true,
        isActive: isGuide
      },
      { 
        key: 'aave', 
        to: '/aave-demo', 
        icon: '🏦', 
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
        const baseClasses = `flex items-center gap-3 p-4 text-lg font-medium transition-colors w-full text-left ${
          isActive 
            ? 'bg-indigo-500/20 text-indigo-300 border-r-2 border-indigo-400' 
            : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`;
        
        return (
          <button
            key={i.key}
            type="button"
            className={baseClasses}
            onClick={() => handleMobileNavigation(i.to, i.key === 'aave')}
          >
            <span className="text-lg">{i.icon}</span>
            {i.label}
          </button>
        );
      }

      // Desktop - use Link components
      const isActive = i.isActive;
      const baseClasses = `flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
        isActive 
          ? 'bg-indigo-500/20 text-indigo-300 shadow-lg' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`;

      return (
        <Link
          key={i.key}
          to={i.to}
          className={baseClasses}
          onClick={() => { if (menuOpen) setMenuOpen(false); }}
        >
          <span className="text-lg">{i.icon}</span>
          {i.label}
        </Link>
      );
    });
  };

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-105 transition-transform">
                🚀
              </div>
              <div>
                <div className="text-xl font-bold text-white">RealMint</div>
                <div className="text-xs text-gray-400 -mt-1">Build Trust</div>
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
              className="md:hidden p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          
          {/* Slide-out Menu */}
          <nav
            className="absolute top-0 right-0 w-80 h-full bg-slate-900/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl"
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
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white">
                  🚀
                </div>
                <div>
                  <div className="text-white font-bold text-lg">RealMint</div>
                  <div className="text-gray-400 text-sm">Navigation</div>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                onClick={() => setMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Mobile Navigation Links */}
            <div className="p-4 space-y-2">
              {renderNavItems(true)}
            </div>

      {/* Aave demo is exposed via the menu items above */}

            {/* Additional Info Section */}
            <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/10 bg-slate-900/80">
              <div className="text-xs text-gray-400 text-center">
                RealMint v1.0 • Build Trust
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