Building the webapp (options)

This project ships several ways to build the frontend to avoid common local issues (Wayland/Qt, flaky network, CI):

1) Normal local build (fast)

```bash
# from repo root
npm --prefix webapp run build
```

2) Headless/Xvfb fallback (when Wayland/Qt causes errors)

```bash
# Try offscreen first; fallback to xvfb-run if available
npm --prefix webapp run build:headless
```

Make sure `xvfb` is installed on Debian/Ubuntu if you need the fallback:

```bash
sudo apt-get update
sudo apt-get install -y xvfb
```

3) Docker build (isolated, recommended on machines where GUI/native modules break)

This repository includes `webapp/Dockerfile.build` which produces a clean production build inside an official Node image.

```bash
# from repo root
npm --prefix webapp run build:docker
# or manually
docker build -f webapp/Dockerfile.build -t realmint-webapp-build webapp
docker create --name tmp-build realmint-webapp-build
docker cp tmp-build:/app/dist ./webapp/dist
docker rm -f tmp-build
```

4) If npm install fails due to network timeouts


```bash
npm set fetch-retries 5
npm set fetch-retry-factor 10
npm set fetch-retry-mintimeout 20000
npm set fetch-retry-maxtimeout 120000
npm --prefix webapp install --no-audit --no-fund
```


```bash
npm config set proxy http://proxy.host:port
npm config set https-proxy http://proxy.host:port
```


## WalletConnect notes

This project includes optional WalletConnect support. A few details to know when deploying or customizing:

- The webapp preloads the `@walletconnect/web3-provider` package on demand to keep the initial bundle small. The provider is dynamically imported when the user selects the WalletConnect option.
- Some WalletConnect-related packages expect a Node-like `global` variable during module initialization. The app applies a minimal `window.global = window` shim before dynamically importing the provider to avoid `ReferenceError: global is not defined` in the browser.
 - Some WalletConnect-related packages expect a Node-like `global` variable during module initialization. The app applies a minimal `window.global = window` shim before dynamically importing the provider to avoid `ReferenceError: global is not defined` in the browser.
 - A small `Buffer` polyfill (package `buffer`) is dynamically imported when required by some CJS-style dependencies; if you see `Buffer is not defined` errors in dev, ensure `buffer` is installed in the `webapp` workspace (it's a normal dependency in package.json).
- If you prefer to bundle WalletConnect upfront, install the package in the `webapp` folder and it will be included in the build:

```bash
cd webapp
npm install @walletconnect/web3-provider
```

- If you'd like to replace the default WalletConnect QR modal with a custom in-app modal (desktop QR + mobile deep links), I can implement a small UI that generates QR images from the WalletConnect URI and handles deep-linking. This requires reading the provider's connector URI and displaying it in a modal.

## Runtime API_BASE override

- The webapp exposes a small runtime override for the backend base URL. `API_BASE` in `src/config.js` is a function that will read `window.__RUNTIME_API_BASE` if present, otherwise fall back to the compile-time `VITE_API_BASE`. This allows servers to inject the API base URL at runtime (useful when serving the built assets from a static server while the API is hosted elsewhere).

When writing tests or utilities that consume `API_BASE`, remember it can be a function; the client helper `src/utils/creditApi.js` already calls it if needed.

If you'd like, I can add a small `Makefile` wrapper to run the Docker build and copy the dist for you. Let me know which build path you want me to try next and I'll run it.