import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Fix base path for proper asset loading
    base: './',
    // Define global constants
    define: {
      'import.meta.env.VITE_API_BASE': JSON.stringify(
        env.VITE_API_BASE || '/api'
      ),
      'import.meta.env.VITE_WALLETCONNECT_PROJECT_ID': JSON.stringify(
        env.VITE_WALLETCONNECT_PROJECT_ID || ''
      ),
      'import.meta.env.VITE_DEFAULT_CHAIN_ID': JSON.stringify(
        env.VITE_DEFAULT_CHAIN_ID || '97'
      ),
      __APP_ENV__: JSON.stringify(env.APP_ENV || mode),
    },
    // Development server configuration
    server: {
      port: 5173,
      host: true, // Listen on all addresses
      strictPort: true,
      open: true, // Auto-open browser
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    // Preview server (for testing build)
    preview: {
      port: 4173,
      host: true,
      strictPort: true,
    },
    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production', // Enable sourcemaps in dev/preview
      minify: 'esbuild', // Use esbuild which is built into Vite
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks for better caching
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ethers': ['ethers'],
            'vendor-wallet': ['@web3modal/ethers', '@web3modal/ui'],
          },
          // Ensure proper asset naming
          assetFileNames: (assetInfo) => {
            if (/\.(gif|jpe?g|png|svg)$/.test(assetInfo.name)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            if (/\.css$/.test(assetInfo.name)) {
              return 'assets/css/[name]-[hash][extname]';
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
      // Enable chunk size warnings
      chunkSizeWarningLimit: 1000,
    },
    // CSS configuration
    css: {
      devSourcemap: true, // Enable sourcemaps for CSS in development
      modules: {
        localsConvention: 'camelCase',
      },
    },
    // Resolve configuration
    resolve: {
      alias: {
        // Add path aliases if needed
        '@': '/src',
      },
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      exclude: ['@web3modal/ethers', '@web3modal/ui'], // Exclude to prevent pre-bundling issues
    },
  };
});
