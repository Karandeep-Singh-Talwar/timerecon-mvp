# TimeRecon — AI Workday Reconstruction System

> **Working Name**: TimeRecon
> **Phase**: 0 — Product/Tech Design
> **Last Updated**: 2026-08-10
> **Architect**: Claude Opus (Senior Product Architect)
> **Implementer**: Gemini Flash (Primary Execution Agent)

---

## Product Summary

TimeRecon reconstructs a software developer's workday from digital evidence (Jira, GitHub, Calendar) and presents an explainable, editable timesheet that the developer reviews and approves.

**Core Promise**: "Instead of reconstructing your workday from memory, review what AI reconstructed for you."

**Primary Hypothesis**: Can we reconstruct a developer's workday well enough that they would rather review and approve the AI-generated timesheet than manually create it?

**Primary Metric**: Time from end-of-workday → submitted timesheet (target: <1 minute review vs 15+ minutes manual).

**Secondary Metric**: Percentage of workday confidently allocated without human intervention.

---

## Key Product Principles

1. AI assists, never silently invents
2. Uncertainty is acceptable — "I don't know" > wrong allocation
3. No commit ≠ no work; no artifact ≠ no work
4. The system reconstructs work; it does not judge productivity
5. Users correct AI in seconds, not minutes
6. Every AI decision is explainable
7. Timesheets require human approval — always
8. No surveillance: no screenshots, webcam, keystroke logging, mouse tracking, productivity scoring

---

## Decision Log

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-08-10 | Working name: TimeRecon | Descriptive, non-surveillance connotation | Active |
| 2026-08-10 | Stack: Next.js + PostgreSQL + Prisma | See ARCHITECTURE.md for full rationale | Active |
| 2026-08-10 | Phase 0 complete | Design documents produced | Active |

---

## Implementation Audit (2026-08-10)

This repository contains a functioning prototype pipeline, not a fully verified production MVP.
The assessment below is based on source inspection, a running-server probe, the current test suite,
and a production build.

| Area | Status | Notes |
|---|---|---|
| Account registration and credential sign-in | Partial | Registration and credential sign-in exist; route protection is being hardened. |
| Jira, GitHub, and Google Calendar OAuth | Partial | Connector implementations exist, but live credentials are not configured locally. |
| Mock/dogfood data | Working | Five-day synthetic data and mock connectors support repeatable evaluation. |
| Evidence normalization | Partial | Vendor events are normalized and deduplicated heuristically; stable provider event IDs are still needed. |
| Reconstruction and confidence | Partial | Timeline, candidate scoring, uncertainty, and evidence exist; interval and evidence precision need hardening. |
| Review, split, merge, and export | Partial | Core routes/UI exist, but authorization, invariants, and submission rules require hardening. |
| Automated tests | Partial | 53 mock-backed Vitest tests pass; route-level, browser E2E, and live-provider coverage are missing. |
| Deployment quality | Partial | Production build passes; lint fails and queue/integration configuration is not deployment-ready. |

## MVP Checklist

| Capability | Status |
|---|---|
| Signup, login, logout, and session persistence | Partial |
| Jira/GitHub/Google Calendar connection and sync status | Partial |
| Normalized evidence storage | Working |
| Explainable reconstruction with explicit uncertainty | Partial |
| Unallocated and no-deliverable work | Working |
| Edit, split, merge, reassign, and leave unallocated | Partial |
| Approved timesheet and CSV export | Partial |
| Cross-user authorization | In progress |
| Cross-organization isolation | Missing (single-user ownership is implemented; organization scoping is not) |
| Unit, integration, and browser E2E coverage | Partial |

## Current Status

- [x] Phase 0 — Product/Tech Design
- [x] Phase 1 — Scaffold
- [x] Phase 2 — Integrations
- [x] Phase 3 — Normalized Evidence
- [x] Phase 4 — Workday Reconstruction
- [x] Phase 5 — Allocation Engine
- [x] Phase 6 — Review Experience
- [x] Phase 7 — Timesheet Export
- [x] Phase 8 — Testing
- [x] Phase 9 — Dogfooding


---

## Known Limitations

1. MVP supports only Jira Cloud (not Jira Server/Data Center)
2. MVP supports only GitHub (not GitLab, Bitbucket)
3. MVP supports only Google Calendar (not Microsoft/Outlook)
4. No mobile app
5. No enterprise SSO/SAML
6. No payroll/HR integrations
7. No team/manager dashboards beyond basic org view
8. AI reasoning uses heuristic confidence, not ML-trained models (MVP)
9. CSV export only — no direct timesheet system integrations
10. Single-tenant architecture initially

---

## Assumptions

1. Developers have at least Jira + GitHub active during work
2. Calendar events have meaningful titles (not just "Busy")
3. OAuth tokens for Jira/GitHub/Google Calendar are obtainable
4. LLM API (Gemini/OpenAI) is available for disambiguation
5. Users will correct AI errors if the process takes <30 seconds
6. Work hours are roughly predictable per user (configurable)
7. Most engineering work touches at least one of: Jira, GitHub, or Calendar

---

## Technical Debt (Tracked)

| Item | Priority | Notes |
|------|----------|-------|
| No rate limiting on API sync jobs | Medium | Add before multi-user |
| No webhook-based real-time sync | Low | Polling is fine for MVP |
| Confidence model is heuristic | Medium | Replace with learned model post-MVP |
| No audit log | Medium | Add before enterprise |
