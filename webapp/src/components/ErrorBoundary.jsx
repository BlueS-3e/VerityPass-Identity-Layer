import React from 'react';
import ErrorPage from './ErrorPage';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Consider hooking into analytics/Sentry in the future.
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          title="Something went wrong"
          message="An unexpected error occurred. Please try reloading the page or come back later."
          ctaLabel="Reload"
          ctaTo={typeof window !== 'undefined' ? window.location.pathname : '/'}
        />
      );
    }

    return this.props.children;
  }
}
