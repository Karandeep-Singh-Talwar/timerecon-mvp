# TimeRecon — Implementation TODO

> **Last Updated**: 2026-08-11  
> Takeover audit complete. Prototype exists; track remaining work below.

---

## Done this takeover

- [x] Run app + Vitest; dogfood mock path
- [x] Fix timezone-aware dogfood seed (wall clock in user TZ)
- [x] Wire allocation continuity (prev/next + bridged gaps ≤90m soft / same-ticket bridge)
- [x] Prevent unrelated PR reviews inheriting prior ticket via continuity
- [x] Add `providerEventId` + normalizer dedupe
- [x] Temporal workflows for sync + reconstruct; `npm run worker`
- [x] Add `npm test`; Vitest passing
- [x] Hostile API journey: sync → timeline → split → approve → submit → CSV
- [x] Expand point-event clusters (~30m+ commit-backward / investigation pad)
- [x] Absorb ≤15m gaps into adjacent work blocks
- [x] Mark OAuth expired on refresh/401 failure + Settings reconnect UX
- [x] Temporal sync status poll API + Integrations UI wait loop
- [x] Settings profile load/save (`GET/PATCH /api/user/profile`) + sidebar name from DB
- [x] Connectors populate `externalId` for providerEventId (Jira worklogs + mock Jira)
- [x] Normalizer dedupe unit test

---

## P0 / P1 remaining

- [ ] Verify live Jira / GitHub / Google Calendar OAuth with real credentials
- [ ] Auto-reconstruct timeline after Temporal sync completes (optional UX)
- [ ] Redeploy Vercel so production gets profile + reconstruction fixes

## P2

- [ ] Playwright critical-path browser E2E
- [ ] Organization scoping (cross-org isolation)
- [ ] Remove BullMQ deps once Temporal is default in deploy
- [ ] Partial unique DB index on `(userId, provider, providerEventId)` WHERE NOT NULL (after ops approval)
- [ ] Rate limiting on sync endpoints

## Explicit non-goals (for now)

- Extra integrations (Slack, GitLab, etc.)
- Surveillance / productivity scores
- Billing / enterprise admin dashboards
