import { defineConfig } from 'vite';

// Explicitly disable auto-open in the dev server and ensure host is enabled.
// This avoids attempts to open the system browser (which on some Wayland/QT
// setups triggers the QSocketNotifier error). We keep the config minimal so it
// won't interfere with the project's existing build settings.
export default defineConfig({
  server: {
    host: true,
    open: false,
    // Use a non-default dev port to avoid collisions with other services.
    // If 5173 is already in use on your machine, this moves the dev server to 5174.
    port: 5174,
    // Proxy API calls to the Flask backend during local development so
    // requests like `/api/admin/nonce` return JSON from the backend
    // instead of Vite serving index.html.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
});
