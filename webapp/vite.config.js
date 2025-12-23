import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Vite config: include small aliases for some Node built-ins that are
// harmlessly imported by a few wallet/connect libs, and also proxy API
// calls to the Flask backend during local development.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  build: {
    sourcemap: !process.env.CI, // Only enable sourcemaps in dev/preview to avoid slow builds on Vercel
    rollupOptions: {
      output: {
        // Encourage splitting heavy wallet libraries and ethers into separate
        // chunks so they don't inflate the main bundle. The keys here target
        // module id patterns and common package names.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('ethers') || id.includes('@ethersproject')) return 'vendor-ethers';
            if (id.includes('wagmi') || id.includes('web3modal') || id.includes('walletconnect')) return 'vendor-wallet';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor';
          }
        }
      }
    }
  }
});
