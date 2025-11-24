import React from 'react';
import { Link } from 'react-router-dom';

export default function ErrorPage({ title = 'Something went wrong', message = '', ctaLabel = 'Go to Homepage', ctaTo = '/' }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center bg-gray-900 border border-gray-700 rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-3">{title}</h1>
        {message ? <p className="text-gray-300 mb-6">{message}</p> : null}
        <Link to={ctaTo} className="inline-block px-5 py-2 bg-gradient-to-r from-teal-400 to-blue-500 text-black rounded font-semibold">{ctaLabel}</Link>
      </div>
    </div>
  );
}
