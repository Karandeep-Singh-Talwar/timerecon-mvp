# TimeRecon — AI Workday Reconstruction System

> **Working Name**: TimeRecon  
> **Phase**: MVP hardening (post-takeover)  
> **Last Updated**: 2026-08-11

---

## Product Summary

TimeRecon reconstructs a software developer's workday from digital evidence (Jira, GitHub, Calendar) and presents an explainable, editable timesheet for human review and approval.

**Core Promise**: "Instead of reconstructing your workday from memory, review what AI reconstructed for you."

---

## Status Matrix (verified 2026-08-12)

| Feature | Status | Comments | Priority |
|---|---|---|---|
| Auth (register/login/session + route gate) | WORKING | Credentials + ownership checks on APIs | — |
| Settings profile load/save | WORKING | `GET/PATCH /api/user/profile`; sidebar uses DB name | — |
| Jira / GitHub / Calendar OAuth connectors | PARTIAL | Real connectors exist; local dogfood uses mock | P1 live OAuth verify |
| Mock connectors + demo seed | WORKING | 5-day dogfood seed timezone-aware | — |
| Evidence normalization | WORKING | `providerEventId` + heuristic fallback dedupe | — |
| Workday timeline grouping | WORKING | Calendar anchors, clusters, point-span expansion | — |
| Allocation + continuity | WORKING | Sequential scoring; gap bridge; point-span expansion (~30m+) | P2 calibrate |
| Explainability (evidence panel) | WORKING | Continuity/learning not faked as event evidence | — |
| Review / edit / split / merge / unallocated | WORKING | Verified via API dogfood | — |
| Timesheet submit + CSV export | WORKING | Submit requires all approved | — |
| Background jobs | WORKING | Temporal workflows (opt-in `USE_TEMPORAL=true`); inline default | — |
| BullMQ | DEPRECATED | Kept as `worker:bullmq` fallback only | — |
| Org multi-tenant isolation | MISSING | User ownership only | P2 |
| Playwright browser E2E | MISSING | Vitest suite green; no Playwright specs | P2 |
| Live OAuth in this workspace | UNVERIFIED | Needs real client IDs | P1 |

---

## Key principles

1. AI assists, never silently invents  
2. Uncertainty > wrong confident allocation  
3. No commit ≠ no work  
4. No surveillance features  
5. Human approval always required for timesheets  

---

## Recent architectural decisions

1. **Temporal replaces BullMQ** as primary durable job layer (`integrationSyncWorkflow`, `workdayReconstructWorkflow`). Default remains inline sync unless `USE_TEMPORAL=true`.
2. **Seed/event wall-clock times use user timezone** via shared `zonedDateTime` helper — fixes IST/UTC gap inflation.
3. **Allocation engine scores sequentially** and applies temporal continuity across gaps; unrelated PR reviews do not inherit prior ticket continuity.
4. **`NormalizedEvent.providerEventId`** for stable re-sync dedupe (app-level match; no destructive unique constraint on Neon).
