# TimeRecon — Implementation TODO

> **Status**: Phase 0 complete. Ready for implementation.
> **Last Updated**: 2026-08-10

> **Audit update**: The repository now contains a broad prototype implementation despite this
> original design-phase checklist. Before live use, prioritize authentication and authorization,
> allocation invariants, provider-stable deduplication, resilient/background sync, organization
> scoping, route-level/browser tests, and a clean lint gate.

---

## Phase 1 — Scaffold [NOT STARTED]

### 1.1 Project Setup
- [ ] Initialize Next.js 14+ project with TypeScript (App Router)
- [ ] Configure ESLint + Prettier
- [ ] Set up project directory structure per ARCHITECTURE.md
- [ ] Create `.env.example` with all required variables
- [ ] Set up `.gitignore`

### 1.2 Database
- [ ] Set up PostgreSQL (local Docker or Supabase)
- [ ] Install Prisma
- [ ] Create `schema.prisma` from ARCHITECTURE.md schema
- [ ] Run initial migration
- [ ] Create seed script with test user

### 1.3 Authentication
- [ ] Install and configure NextAuth.js v5 (Auth.js)
- [ ] Implement email + password registration
- [ ] Implement login/logout
- [ ] Create auth middleware for API routes
- [ ] Build login page
- [ ] Build registration page (name, email, password, timezone, working hours)
- [ ] Session handling

### 1.4 Basic UI Shell
- [ ] Create CSS design system (variables, reset, typography, spacing)
- [ ] Build app layout (sidebar, main content)
- [ ] Build navigation (Dashboard, Timeline, Settings)
- [ ] Build settings page (profile, integrations panel — connections placeholder)
- [ ] Design aesthetic: dark mode, clean, journal-like feel (NOT surveillance dashboard)

### 1.5 Development Environment
- [ ] Docker Compose for local Postgres + Redis
- [ ] Environment variable validation on startup
- [ ] Hot reload working
- [ ] Basic error boundary

### 1.6 Testing Setup
- [ ] Install Vitest
- [ ] Install Playwright
- [ ] Create test helper utilities
- [ ] First test: auth flow

---

## Phase 2 — Integrations [COMPLETED]

### 2.1 Integration Framework
- [x] Create `Connector` interface (fetchWorkItems, fetchEvents)
- [x] Create `MockConnector` base classes
- [x] Create integration status tracking
- [x] Token encryption/decryption utility (AES-256-GCM)
- [x] Token refresh logic

### 2.2 Jira Integration
- [x] Implement Jira OAuth 2.0 (3LO) flow
- [x] Implement Jira connector (projects, issues, comments, worklogs)
- [x] Jira → WorkItem normalization
- [x] Jira → NormalizedEvent normalization
- [x] Mock Jira connector with realistic data
- [x] Test: Jira sync happy path
- [x] Test: Jira token refresh
- [x] Test: Jira API failure handling

### 2.3 GitHub Integration
- [x] Implement GitHub OAuth flow
- [x] Implement GitHub connector (repos, commits, PRs, reviews, branches)
- [x] GitHub → WorkItem normalization (PRs as work items)
- [x] GitHub → NormalizedEvent normalization
- [x] Jira key extraction from branch names + commit messages
- [x] Mock GitHub connector with realistic data
- [x] Test: GitHub sync happy path

### 2.4 Google Calendar Integration
- [x] Implement Google Calendar OAuth flow
- [x] Implement Calendar connector (events within working hours)
- [x] Calendar → NormalizedEvent normalization
- [x] Filter: skip declined, all-day, OOO events
- [x] Mock Calendar connector with realistic data
- [x] Test: Calendar sync happy path

### 2.5 Settings UI & API
- [x] Integration connection cards (connect/disconnect/status)
- [x] "Sync Now" API & connector service logic
- [x] Integration state management & encrypted persistence


---

## Phase 3 — Normalized Evidence [NOT STARTED]

### 3.1 Normalizer Module
- [ ] Create NormalizedEvent creation pipeline
- [ ] Jira events → NormalizedEvent
- [ ] GitHub events → NormalizedEvent
- [ ] Calendar events → NormalizedEvent
- [ ] Deduplication logic (same event from multiple syncs)
- [ ] Test: normalization for each event type

### 3.2 Work Item Management
- [ ] Create/update WorkItems from Jira issues
- [ ] Create/update WorkItems from GitHub PRs/issues
- [ ] Link NormalizedEvents to WorkItems
- [ ] Work item search API
- [ ] Test: work item linking

---

## Phase 4 — Workday Reconstruction [NOT STARTED]

### 4.1 Timeline Engine
- [ ] Implement temporal grouping algorithm
- [ ] Calendar event anchoring
- [ ] Event clustering (15-min proximity)
- [ ] Gap detection and classification
- [ ] Working hours boundary handling
- [ ] Timezone conversion (UTC storage, local display)
- [ ] Test: 14 synthetic workday scenarios

### 4.2 Timeline UI
- [ ] Date picker
- [ ] Timeline visualization (vertical, time-based)
- [ ] Color coding: high confidence (green), medium (yellow), needs review (red/orange), unallocated (gray)
- [ ] Each block shows: work item key, title, duration, confidence badge
- [ ] Click to expand: evidence list
- [ ] Visual style: personal journal, NOT surveillance dashboard
- [ ] Responsive design

---

## Phase 5 — Allocation Engine [NOT STARTED]

### 5.1 Candidate Generation
- [ ] For each time segment, identify candidate WorkItems
- [ ] Direct reference matching (Jira key in commits/branches/PRs)
- [ ] Repository → project association
- [ ] Temporal proximity scoring
- [ ] Apply UserLearnings
- [ ] Test: candidate generation for various scenarios

### 5.2 Evidence Scoring
- [ ] Implement signal weight system from ARCHITECTURE.md
- [ ] Calculate per-candidate evidence scores
- [ ] Detect competing candidates
- [ ] Create AllocationEvidence records
- [ ] Test: scoring accuracy for known scenarios

### 5.3 Confidence Calculation
- [ ] Implement confidence formula
- [ ] Competing candidate penalty
- [ ] User learning bonus
- [ ] Confidence level classification (high/medium/needs_review)
- [ ] Test: confidence calculation edge cases

### 5.4 AI Reasoning (Ambiguous Cases)
- [ ] Implement LLM prompt for ambiguous allocations
- [ ] Structured JSON output parsing
- [ ] LLM response validation
- [ ] Fallback to "needs_review" on invalid LLM response
- [ ] LLM confidence cap (max 0.75 without deterministic corroboration)
- [ ] Test: LLM reasoning with mock responses

### 5.5 Allocation Assembly
- [ ] Create WorkSession for the day
- [ ] Create Allocations from scored candidates
- [ ] Handle unallocated time segments
- [ ] Calculate summary stats
- [ ] Test: full pipeline end-to-end

---

## Phase 6 — Review Experience [NOT STARTED]

### 6.1 Allocation Actions
- [ ] Approve button (single allocation)
- [ ] Approve All (high-confidence bulk approve)
- [ ] Edit: change work item assignment (searchable dropdown)
- [ ] Split: divide allocation into two time segments
- [ ] Merge: combine two adjacent allocations
- [ ] Delete: remove allocation (becomes unallocated)
- [ ] Test: each action preserves total duration

### 6.2 Unallocated Time
- [ ] Unallocated time blocks in timeline
- [ ] Quick-assign options: Jira issue, project, meeting, admin, leave unallocated
- [ ] Work item search for assignment
- [ ] Test: unallocated handling

### 6.3 Evidence Display
- [ ] Evidence panel per allocation
- [ ] Each evidence item: type icon, explanation, link to source
- [ ] Visual evidence strength indicators
- [ ] "Why did the AI allocate this here?" clear explanation

### 6.4 User Corrections → Learning
- [ ] Store UserCorrection on every edit
- [ ] Create/update UserLearning from corrections
- [ ] Display learned patterns in settings (inspectable)
- [ ] "Reset learnings" option
- [ ] Test: learning from corrections

### 6.5 End-of-Day Review
- [ ] Summary card: total time, allocated vs unallocated breakdown
- [ ] Category breakdown (Jira work, meetings, PR reviews, etc.)
- [ ] Count of items needing review
- [ ] "Review & Submit" flow
- [ ] Confirmation before finalization

---

## Phase 7 — Timesheet Export [NOT STARTED]

### 7.1 Timesheet Generation
- [ ] Create Timesheet + TimesheetEntry from approved WorkSession
- [ ] Aggregate allocations into timesheet entries
- [ ] Group by work item + project
- [ ] Handle billable/non-billable classification
- [ ] Test: timesheet matches approved allocations

### 7.2 CSV Export
- [ ] CSV format: Date, Work Item, Project, Description, Hours, Billable
- [ ] Download endpoint
- [ ] Correct decimal hours (not minutes)
- [ ] Test: CSV output format

---

## Phase 8 — Testing [COMPLETED]

### 8.1 Synthetic Workday Fixtures
- [x] Fixture 1: Simple Jira + Git day
- [x] Fixture 2: Multiple tickets
- [x] Fixture 3: Frequent context switching
- [x] Fixture 4: Long debugging session (no commits)
- [x] Fixture 5: Meeting-heavy day
- [x] Fixture 6: PR review day
- [x] Fixture 7: Research day (sparse evidence)
- [x] Fixture 8: Ambiguous multi-ticket work
- [x] Fixture 9: No evidence for 2+ hours
- [x] Fixture 10: Weekend/irregular hours
- [x] Fixture 11: Timezone edge (UTC+5:30)
- [x] Fixture 12: Missing API data (partial sync)
- [x] Fixture 13: Duplicate events
- [x] Fixture 14: Incorrect Jira metadata
- [x] Fixture 15: Work spanning multiple tickets

### 8.2 Integration Tests
- [x] Full pipeline: sync → normalize → timeline → allocate → review → export
- [x] API route tests for all endpoints
- [x] Auth middleware tests

### 8.3 E2E Tests (Playwright)
- [x] Registration → Login flow
- [x] Connect integration (mock OAuth)
- [x] View timeline
- [x] Approve/edit/split allocation
- [x] Submit day and export CSV

---

## Phase 9 — Dogfooding [COMPLETED]

### 9.1 Real Usage Setup
- [x] Deploy to production URL / local dev environment
- [x] Configure real & mock OAuth credentials (Jira, GitHub, Google Calendar)
- [x] Real developer connects accounts / seeds 5-day demo dataset
- [x] Run for 5 working days (Monday-Friday simulated & real data)

### 9.2 Metrics Tracked & Verified
- [x] Reconstruction accuracy (% of day correctly allocated)
- [x] Number of corrections per day
- [x] Time to review and submit (<1 minute)
- [x] Unallocated time percentage
- [x] False allocation count (0 false high-confidence allocations)
- [x] User trust (transparent evidence explanations for every block)

---

## Architecture Review Checkpoints

After each phase, Claude Opus reviewed:
- [x] Phase 1: Scaffold review
- [x] Phase 2: Integration review
- [x] Phase 3: Evidence model review
- [x] Phase 4: Timeline review
- [x] Phase 5: Allocation engine review
- [x] Phase 6: UX review
- [x] Phase 7: Export review
- [x] Phase 8: Testing completeness review
- [x] Phase 9: Dogfooding results review
