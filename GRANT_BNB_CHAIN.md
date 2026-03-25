# RealMint BNB Chain Grant Positioning

## Purpose

This document explains why `webapp-admin` remains a critical part of the BNB-first strategy and how it supports a strong BNB Chain grant application.

## BNB-First Thesis

RealMint is positioning as BNB Chain-native credit infrastructure:
- Identity-backed attestations
- Risk-aware credit scoring
- Under-collateralized lending operations

To ship this safely, we need an operator console for governance and production controls.

## Why `webapp-admin` Is Needed

The admin app is not a secondary product UI. It is a restricted operations console for:
- Role assignment and permission boundaries
- Role change audit trail for accountability
- Project moderation and lifecycle controls
- On-chain owner verification checks

These capabilities directly support grant priorities around security, trust, and operational maturity.

## Current Operational Capabilities

`webapp-admin` currently supports:
- Wallet/SSO/password admin authentication paths
- Role management (`/api/admin/roles`)
- Role audit review (`/api/admin/role-audit`)
- Owner verification workflows (`/api/admin/verify-owner`)
- Submission moderation (`/api/admin/projects`)

## BNB Grant Narrative

When presenting to BNB Chain grants, position `webapp-admin` as:
- BNB Chain Risk Ops Console
- Governance enforcement layer for issuer/attestation trust
- Evidence generator for transparent operations and post-grant reporting

## Milestone Framing

1. BNB Testnet Operations
- Run end-to-end moderation and owner verification on chain id 97.
- Publish process screenshots and API logs.

2. BNB Mainnet Operations
- Enable production role governance and incident procedures on chain id 56.
- Record owner verification checks and role-audit events monthly.

3. Transparency Deliverables
- Quarterly operations report with:
  - role changes
  - owner verification checks
  - moderation outcomes

## What To Avoid

- Do not market `webapp-admin` as a public dApp feature.
- Do not remove governance/audit controls to simplify scope.
- Do not keep stale docs that reference missing entrypoints.

## Summary

A BNB-first protocol still needs secure, auditable operations. `webapp-admin` should be retained and framed as infrastructure for governance, trust, and risk management in the BNB ecosystem.
