import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getSelectedFlow } from '../flowGate';

export default function Footer(){
  const loc = useLocation();
  const selectedFlow = getSelectedFlow();
  return (
    <footer className="mt-12 border-t border-gray-800 pt-6 pb-12 text-sm text-gray-400">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-white font-semibold">RealMint</div>
          <div className="mt-2 text-xs">A simple launchpad for curated projects. For testing purposes only.</div>
        </div>
          <div className="flex items-center gap-6">
          <Link to="/" className="hover:text-white">Home</Link>
          {selectedFlow !== 'launchpad' && loc.pathname !== '/attestation' && (
            <Link to="/attestation" className="hover:text-white">Attest</Link>
          )}
          <a href="https://github.com/" className="hover:text-white">Docs</a>
        </div>
        <div className="text-xs text-gray-500">© {new Date().getFullYear()} RealMint — Prototype</div>
      </div>
    </footer>
  );
}
