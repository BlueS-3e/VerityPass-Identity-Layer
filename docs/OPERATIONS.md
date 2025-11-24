# Operations: Ownership, Multisig & Monitoring

This document describes recommended operational steps to harden the RealMint platform's admin/fee recipient and how to verify ownership on-chain.

1) Create a multisig (Gnosis Safe)
   - Create a Safe with your operator signers and a 2-of-3 (or higher) threshold.
   - Record the Safe address securely.

2) Transfer contract ownership to the Safe
   - From the current owner account (the deployer), run the Hardhat helper:

     npx hardhat run --network <network> contracts/scripts/transfer-owner.js --newOwner <SAFE_ADDR> --contract <CONTRACT_ADDR>

   - Alternatively set env vars and run:
     NEW_OWNER=<SAFE_ADDR> CONTRACT_ADDR=<CONTRACT_ADDR> npx hardhat run --network <network> contracts/scripts/transfer-owner.js

   - Verify owner() equals the Safe address. You can use the included `scripts/check-owner.js`:

     RPC_URL=https://... CONTRACT_ADDR=<CONTRACT_ADDR> EXPECTED_OWNER=<SAFE_ADDR> node scripts/check-owner.js

   - The script exits non-zero if the owner does not match EXPECTED_OWNER, suitable for CI gating.

      - CI / GitHub Actions: this repo includes a release workflow that runs `scripts/check-owner.js` during release. To enable it, set the following repository secrets under Settings → Secrets:
         - CHECK_OWNER_RPC_URL: RPC endpoint used to query the chain (read-only)
         - CHECK_OWNER_CONTRACT_ADDR: deployed contract address to verify
         - CHECK_OWNER_EXPECTED_OWNER: expected owner (Gnosis Safe / timelock) used as the authoritative recipient

         If the owner() mismatches the expected address, the release workflow will fail and block the release.

3) Configure frontend (display-only)
   - Keep `VITE_PAYMENT_ADDRESS` in your frontend env only for display purposes. The canonical recipient is `owner()` on-chain.
   - After transferring owner to the Safe, set `VITE_PAYMENT_ADDRESS` to the Safe address for operator transparency.

   7) Server-side feature gating for Launchpad

   - You can fully disable the Launchpad creation flow on the server by setting the environment variable `ENABLE_LAUNCHPAD=false` when starting the API. When disabled:
      - Public POST `/api/projects` will return HTTP 403 and a JSON `{"status":"launchpad_disabled"}` response.
      - The frontend also supports a client-side flag `VITE_ENABLE_LAUNCHPAD=false` to hide the Launchpad UI.

   This two-layer gating (frontend + backend) prevents both accidental exposure and API abuse when you want an attestation-first deployment.

4) Monitoring & alerts
   - Start `scripts/watch-owner.js` (or wire events to your monitoring stack) to watch for critical events:
     - OwnershipTransferred
     - PlatformFeeUsdCentsUpdated
     - Withdrawn

    - Example start (simple):
       RPC_URL=https://... CONTRACT_ADDR=<CONTRACT_ADDR> WEBHOOK_URL=https://hooks.example.com node scripts/watch-owner.js

    - Dockerized service (recommended for reliability):
       - Build image locally:

          docker build -f scripts/Dockerfile.watch -t realmint-watch-owner:local .

       - Run locally:

          docker run --rm -e RPC_URL=https://... -e CONTRACT_ADDR=<CONTRACT_ADDR> -e WEBHOOK_URL=https://hooks.example.com realmint-watch-owner:local

       - Example `systemd` unit (provided at `scripts/watch-owner.service`) runs a docker image. Replace image name and environment variables before enabling.

5) Optional: Timelock
   - For higher assurance, deploy a TimelockController and transfer ownership to the timelock. Then make the Safe a proposer/executor with appropriate roles.

6) Notes
   - The frontend now prefers on-chain `owner()` for the authoritative recipient and will warn if `VITE_PAYMENT_ADDRESS` differs.
   - Never rely on client-side values for critical fund routing. Treat the UI config as display only.
