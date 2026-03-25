import React from 'react';
import { Link } from 'react-router-dom';

export default function ErrorPage({ title = 'Something went wrong', message = '', ctaLabel = 'Go to Homepage', ctaTo = '/' }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-950 via-zinc-900 to-amber-950">
      <div className="max-w-md w-full">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 mb-6">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">{title}</h1>
          {message && <p className="text-gray-300 text-base leading-relaxed mb-8">{message}</p>}
        </div>
        
        <Link 
          to={ctaTo} 
          className="block w-full text-center px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          {ctaLabel}
        </Link>
        
        <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg text-center">
          <p className="text-gray-400 text-sm">Need help? Check the <Link to="/" className="text-blue-400 hover:text-blue-300 underline">homepage</Link> or contact support.</p>
        </div>
      </div>
    </div>
  );
}
