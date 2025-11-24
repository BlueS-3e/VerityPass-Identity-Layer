import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import apiClient from '../utils/apiClient';
import { getSelectedFlow } from '../flowGate';

export default function ProtectedRoute({ children, requireAdmin = false, requireLaunchpad = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      // Launchpad gating: check vite env first (cheap, client-side)
      const enableLaunchpad = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_LAUNCHPAD) !== 'false';
      if (requireLaunchpad && !enableLaunchpad) {
        // If launchpad is disabled, show unauthorized page
        if (mounted) navigate('/unauthorized?reason=disabled', { replace: true });
        return;
      }

      if (requireAdmin) {
        try {
          const j = await apiClient.apiGet('/api/admin/check');
          if (!j || !j.admin) {
            if (mounted) navigate('/unauthorized?reason=admin', { replace: true });
            return;
          }
        } catch (e) {
          // network or server error: show a server error page
          if (mounted) navigate('/error', { replace: true });
          return;
        }
      }

      // Flow gating: if user previously selected Attestation from Home, don't allow visiting Launchpad
      const sel = getSelectedFlow();
      if (requireLaunchpad && sel === 'attestation') {
        // redirect to unauthorized — user must explicitly go back to Home to switch flows
        if (mounted) navigate('/unauthorized?reason=flow', { replace: true });
        return;
      }

      if (mounted) setLoading(false);
    }

    check();
    return () => { mounted = false; };
  }, [requireAdmin, requireLaunchpad, navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-400" />
      </div>
    );
  }

  return <>{children}</>;
}
