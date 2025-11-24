import React from 'react';
import { useLocation } from 'react-router-dom';
import ErrorPage from './ErrorPage';

function getMessageForReason(reason) {
  switch ((reason || '').toLowerCase()) {
    case 'admin':
      return 'This area is restricted to administrators. Please sign in with an admin account.';
    case 'flow':
      return 'You previously selected a different flow. Please return to the homepage to switch workflows.';
    case 'disabled':
      return 'This feature is currently disabled by the operator.';
    default:
      return 'You do not have permission to view this page or the link may be invalid.';
  }
}

export default function Unauthorized() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const reason = params.get('reason');
  const message = getMessageForReason(reason);

  return (
    <ErrorPage
      title={`Sorry! The page you\u2019re looking for cannot be accessed.`}
      message={message}
      ctaLabel="Go to Homepage"
      ctaTo="/"
    />
  );
}
