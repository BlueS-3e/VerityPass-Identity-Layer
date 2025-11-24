export function assertEnv() {
  const missing = [];
  if (!import.meta.env.VITE_API_BASE) missing.push('VITE_API_BASE');
  // VITE_ADMIN_HOST is optional; warn but don't fail
  if (missing.length) {
    const msg = 'Missing required Vite env(s): ' + missing.join(', ');
    // Do not throw from the browser runtime; only log a warning so the UI can still load
    // CI/build-time checks should still fail if desired via separate tooling.
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}
