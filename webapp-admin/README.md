webapp-admin

Dedicated operations console for VerityPass. This lightweight Vite app provides
admin-only controls for BNB-focused production workflows: role management,
audit trails, project moderation, and contract owner verification.

Note: this app is self-contained and boots from `webapp-admin/src/main.jsx`.

Quick start (from project root):

```bash
cd webapp-admin
npm install
npm run dev
```

Troubleshooting (Wayland / QSocketNotifier / headless environments)

- If your desktop uses Wayland you may see errors when tooling tries to open a browser (examples: "Vite does not work (for now) on a Wayland environment" or "QSocketNotifier: Can only be used with threads started with QThread"). These come from the OS/browser open helper, not from the app itself.

- Workarounds:
  - Start the dev server without attempting to open a browser (recommended):

    ```bash
    # Unix / Linux
    npm run dev:no-browser
    # or explicit env form
    BROWSER=none npm run dev -- --host 0.0.0.0
    ```

  - Or set the env var permanently for your shell session, then run normally:

    ```bash
    export BROWSER=none
    npm run dev -- --host 0.0.0.0
    ```

  - If you prefer to use a local browser on another host, run the dev server with `--host 0.0.0.0` and open the printed URL (http://<host>:5173) from your browser.

  - As an alternative on Wayland desktops you can switch to an X session or use an X11-compatible compositor.

If you continue to hit a Qt-related error when starting the dev server, try one of these alternatives:

- Use a virtual X server (Xvfb) so open calls succeed without a real display:

  ```bash
  # on Debian/Ubuntu install: sudo apt install xvfb
  xvfb-run -a npm run dev:no-browser
  ```

- Or build and serve the static site on the host that can run a browser:

  ```bash
  npm run build
  npm run serve-dist
  ```

Notes:
- The dev server runs on port 5173 by default; use `--port` or the `preview` script to change.
- In production, build with `npm run build` and serve the generated `dist/` directory on a
  separate subdomain. Configure CORS (ALLOWED_ORIGINS) and `FRONTEND_ORIGIN` accordingly.

BNB-first positioning guidance:
- Keep this app as a restricted operations surface, not a public marketing UI.
- Use it to demonstrate grant-critical controls: issuer governance, role auditability,
  and on-chain owner checks.
- Pair this with BNB Chain deployment evidence (BscScan links, chain id 56/97 config,
  and verifiable admin runbooks).

Example nginx snippet for hosting the admin frontend on a separate subdomain (admin.example.com)
and proxying API requests to the backend API running on localhost:8000. Adjust TLS and upstream
as appropriate for your environment.

server {
  listen 443 ssl;
  server_name admin.example.com;

  # TLS certs
  ssl_certificate /etc/letsencrypt/live/admin.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/admin.example.com/privkey.pem;

  root /var/www/admin.example.com/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
  }

  # Serve assets
  location / {
    try_files $uri $uri/ /index.html;
  }
}
