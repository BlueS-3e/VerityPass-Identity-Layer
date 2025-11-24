import React from 'react';
import ErrorPage from './ErrorPage';

export default function NotFound() {
  return (
    <ErrorPage
      title={`Sorry! The page you\u2019re looking for cannot be found.`}
      message={`It may have been moved, renamed, or never existed.`}
      ctaLabel="Go to Homepage"
      ctaTo="/"
    />
  );
}
