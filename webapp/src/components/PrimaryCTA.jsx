import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getSelectedFlow } from '../flowGate';

export default function PrimaryCTA({ to, onClick, className = '', hideOnCurrent = true, hideWhenSelectedFlow = [], children, asButton = false, ...rest }) {
  const loc = useLocation();
  let selectedFlow = null;
  try { selectedFlow = getSelectedFlow(); } catch (e) { selectedFlow = null; }

  if (hideOnCurrent && to && loc.pathname === to) return null;
  if (selectedFlow && hideWhenSelectedFlow && hideWhenSelectedFlow.includes(selectedFlow)) return null;

  // If an onClick is provided but we still want the Link behavior, we render a button that calls onClick
  if (onClick) {
    return (
      <button onClick={onClick} className={className} {...rest}>
        {children}
      </button>
    );
  }

  if (asButton) {
    return (
      <Link to={to} className={className} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <Link to={to} className={className} {...rest}>
      {children}
    </Link>
  );
}
