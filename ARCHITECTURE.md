# TimeRecon — Architecture Document

> **Version**: 1.0 — Phase 0
> **Last Updated**: 2026-08-10
> **Author**: Claude Opus (Senior Architect)

---

## Table of Contents

1. [MVP Scope & User Journey](#1-mvp-scope--user-journey)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [API Design](#5-api-design)
6. [Integration Strategy](#6-integration-strategy)
7. [AI Pipeline](#7-ai-pipeline)
8. [Confidence Model](#8-confidence-model)
9. [Security Model](#9-security-model)
10. [Privacy Model](#10-privacy-model)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Strategy](#12-deployment-strategy)
13. [Technical Risks](#13-technical-risks)
14. [Self-Critique](#14-self-critique)

---

## 1. MVP Scope & User Journey

### In-Scope

- User registration/login (email + password)
- Connect Jira Cloud via OAuth 2.0
- Connect GitHub via OAuth App
- Connect Google Calendar via OAuth 2.0
- Sync work evidence (issues, commits, PRs, calendar events)
- Normalize all evidence into a unified event model
- Reconstruct workday timeline for any selected date
- Generate work allocations with confidence + evidence
- Human review: approve, edit, split, merge allocations
- Handle unallocated time as first-class concept
- Store user corrections for learning
- End-of-day review summary
- CSV timesheet export
- Timezone-aware throughout

### Out-of-Scope (MVP)

- Team/manager dashboards
- Enterprise SSO/SAML
- Real-time sync (webhooks)
- Mobile app
- Payroll/HR/ERP integrations
- Billing/subscriptions
- Employee surveillance features
- Multi-language support
- GitLab, Bitbucket, Microsoft Calendar

### User Journey

```
1. SIGN UP
   → Create account (email, password, name, timezone, working hours)

2. CONNECT
   → OAuth connect Jira Cloud
   → OAuth connect GitHub
   → OAuth connect Google Calendar

3. SYNC
   → System fetches work evidence (background job)
   → Status shown to user

4. RECONSTRUCT
   → User selects a date
   → System displays reconstructed timeline
   → Each block: work item, duration, confidence, evidence

5. REVIEW
   → Approve high-confidence blocks (one-click)
   → Edit/split/merge uncertain blocks
   → Handle unallocated time

6. SUBMIT
   → End-of-day summary
   → Approve → finalize timesheet

7. EXPORT
   → Download CSV
```

---

## 2. Technology Stack

### Stack Decision Rationale

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Framework** | Next.js 14+ (App Router) | Full-stack: SSR, API routes, React UI in one codebase. Fast iteration for MVP. |
| **Language** | TypeScript | Type safety, excellent IDE support, shared types front/back. |
| **Database** | PostgreSQL (via Supabase or self-hosted) | Battle-tested, relational integrity for financial-adjacent data, JSON support for flexible evidence storage. |
| **ORM** | Prisma | Type-safe queries, schema-as-code, migrations, excellent DX. |
| **Authentication** | NextAuth.js (Auth.js v5) | Built-in OAuth, session management, extensible. We also need OAuth for integrations, so Auth.js handles the user auth side. |
| **Styling** | Vanilla CSS + CSS Modules | Per requirements. No Tailwind unless requested. |
| **Background Jobs** | BullMQ + Redis | Reliable job queue for sync tasks. Simple, well-tested. |
| **AI/LLM** | Google Gemini API (gemini-2.0-flash) | Fast, cost-effective for reasoning about ambiguous allocations. Structured output support. |
| **State Management** | React Context + SWR | Minimal client state. SWR for data fetching/caching. |
| **Testing** | Vitest + Playwright | Unit + integration + E2E. Fast. |
| **Deployment** | Vercel (app) + Railway/Supabase (DB + Redis) | Zero-config Next.js hosting. Managed Postgres. |

### Why NOT Other Choices

| Rejected | Reason |
|----------|--------|
| Django/Python | Slower frontend iteration; would need separate frontend |
| Ruby on Rails | Same; extra deployment complexity for MVP |
| Microservices | Overengineered for MVP; monolith is correct |
| MongoDB | Relational integrity matters for timesheets/financial data |
| Clerk/Auth0 | External auth adds cost and vendor lock-in for MVP |
| tRPC | Nice-to-have but unnecessary complexity for MVP API |

### Monolith Justification

A monolith is correct for this MVP because:
- Single team/developer
- Shared TypeScript types between frontend and backend
- No scaling concerns yet
- Faster development velocity
- Simpler deployment and debugging

The architecture is designed so the AI pipeline, evidence store, and allocation engine are separable modules — extraction to microservices later is straightforward.

---

## 3. System Architecture

### High-Level Data Flow

```
EXTERNAL SERVICES          APPLICATION LAYER              DATA LAYER
──────────────────         ─────────────────              ──────────

Jira Cloud API ─────┐
                     │     ┌──────────────────┐
GitHub API ──────────┼────▶│  CONNECTOR LAYER  │──────┐
                     │     │  (OAuth + Fetch)  │      │
Google Calendar ─────┘     └──────────────────┘      │
                                                       ▼
                           ┌──────────────────┐   ┌──────────┐
                           │  NORMALIZER      │◀──│ Raw Data │
                           │  (Event → Norm)  │   └──────────┘
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  EVIDENCE STORE   │──▶ PostgreSQL
                           │  (Normalized)     │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  TIMELINE ENGINE  │
                           │  (Temporal Group) │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  ALLOCATION       │
                           │  ENGINE           │
                           │  (Candidates +    │
                           │   Evidence Score) │
                           └────────┬─────────┘
                                    │
                            ┌───────┴────────┐
                            │ Ambiguity?     │
                            └───────┬────────┘
                              No    │    Yes
                              ▼     │     ▼
                        Deterministic│  ┌──────────┐
                        Allocation   │  │ AI/LLM   │
                                     │  │ Reasoning│
                                     │  └────┬─────┘
                                     │       │
                                     ▼       ▼
                           ┌──────────────────┐
                           │  CONFIDENCE      │
                           │  CALCULATOR      │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  USER REVIEW UI  │
                           │  (Timeline +     │
                           │   Approval)      │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  TIMESHEET       │
                           │  (Approved +     │
                           │   Export)        │
                           └──────────────────┘
```

### Module Boundaries

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login, register
│   ├── dashboard/          # Main dashboard
│   ├── timeline/           # Workday timeline view
│   ├── review/             # End-of-day review
│   ├── settings/           # User settings, integrations
│   └── api/                # API routes
│       ├── auth/           # Auth endpoints
│       ├── integrations/   # OAuth callbacks, sync triggers
│       ├── timeline/       # Timeline data
│       ├── allocations/    # Allocation CRUD
│       └── timesheets/     # Timesheet generation/export
├── lib/
│   ├── connectors/         # Jira, GitHub, Calendar adapters
│   │   ├── jira.ts
│   │   ├── github.ts
│   │   └── calendar.ts
│   ├── normalizer/         # Raw events → NormalizedEvent
│   ├── timeline/           # Temporal grouping engine
│   ├── allocation/         # Candidate generation + scoring
│   ├── ai/                 # LLM reasoning (isolated)
│   ├── confidence/         # Confidence calculation
│   ├── learning/           # User correction storage + retrieval
│   └── export/             # CSV generation
├── components/             # React components
│   ├── timeline/
│   ├── allocation/
│   ├── review/
│   └── common/
├── prisma/
│   └── schema.prisma       # Database schema
├── workers/                # Background job definitions
│   └── sync.ts             # Integration sync jobs
└── __tests__/              # Test files
```

---

## 4. Database Schema

### Entity-Relationship Overview

```
User ─────────┬──── Integration (1:many)
              │
              ├──── WorkItem (via Integration → many)
              │
              ├──── NormalizedEvent (many)
              │
              ├──── WorkSession (many)
              │       │
              │       └──── Allocation (many)
              │               │
              │               ├──── AllocationEvidence (many)
              │               │
              │               └──── UserCorrection (0..1)
              │
              ├──── Timesheet (many)
              │       │
              │       └──── TimesheetEntry (many)
              │
              └──── UserLearning (many)
```

### Prisma Schema

```prisma
// ─── IDENTITY ───

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String
  name            String
  timezone        String    @default("UTC")
  workingHoursStart String  @default("09:00")
  workingHoursEnd   String  @default("17:30")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  organizationId  String?
  organization    Organization? @relation(fields: [organizationId], references: [id])

  integrations    Integration[]
  normalizedEvents NormalizedEvent[]
  workSessions    WorkSession[]
  timesheets      Timesheet[]
  userLearnings   UserLearning[]
}

model Organization {
  id              String    @id @default(cuid())
  name            String
  createdAt       DateTime  @default(now())

  users           User[]
  privacySettings PrivacySettings?
}

model PrivacySettings {
  id                    String       @id @default(cuid())
  organizationId        String       @unique
  organization          Organization @relation(fields: [organizationId], references: [id])

  enabledIntegrations   String[]     // ["jira", "github", "calendar"]
  dataRetentionDays     Int          @default(90)
  managersCanViewEvidence Boolean    @default(false)
  collectMeetingAttendees Boolean   @default(true)
}

// ─── INTEGRATIONS ───

model Integration {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  provider        String    // "jira" | "github" | "google_calendar"
  accessToken     String    // encrypted
  refreshToken    String?   // encrypted
  tokenExpiresAt  DateTime?
  externalAccountId String? // e.g., Jira cloudId, GitHub username
  metadata        Json?     // provider-specific config (e.g., selected repos, Jira site)
  status          String    @default("active") // "active" | "expired" | "revoked"
  lastSyncAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, provider])
}

// ─── WORK CONTEXT ───

model WorkItem {
  id              String    @id @default(cuid())
  userId          String
  provider        String    // "jira" | "github"
  externalId      String    // Jira issue key or GitHub issue number
  externalUrl     String?

  // Common fields
  title           String
  description     String?
  status          String?   // "open", "in_progress", "done"
  project         String?   // Jira project key or GitHub repo
  itemType        String?   // "story", "bug", "task", "pr", "issue"

  // Metadata
  metadata        Json?     // provider-specific extra fields
  lastSyncAt      DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  normalizedEvents NormalizedEvent[]
  allocations      Allocation[]

  @@unique([userId, provider, externalId])
}

// ─── NORMALIZED EVIDENCE ───

model NormalizedEvent {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Source
  provider        String    // "jira" | "github" | "google_calendar"
  eventType       String    // "commit" | "pr_opened" | "pr_review" | "pr_merged"
                            // | "issue_updated" | "issue_commented" | "worklog"
                            // | "calendar_event" | "branch_activity"

  // Temporal
  occurredAt      DateTime  // When this event happened
  endedAt         DateTime? // For events with duration (meetings, worklogs)
  duration        Int?      // Duration in minutes (calculated or from source)

  // Context
  title           String    // Human-readable summary
  description     String?   // Detail
  workItemId      String?   // Link to WorkItem if identifiable
  workItem        WorkItem? @relation(fields: [workItemId], references: [id])

  // Evidence metadata
  metadata        Json?     // Raw evidence details (commit SHA, PR number, etc.)
  externalUrl     String?   // Link to source

  createdAt       DateTime  @default(now())

  allocationEvidence AllocationEvidence[]

  @@index([userId, occurredAt])
  @@index([userId, provider, occurredAt])
}

// ─── WORKDAY RECONSTRUCTION ───

model WorkSession {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  date            DateTime  @db.Date  // The workday date
  startTime       DateTime  // Reconstructed start of work
  endTime         DateTime  // Reconstructed end of work
  totalMinutes    Int       // Total reconstructed minutes
  allocatedMinutes Int      // Confidently allocated minutes
  unallocatedMinutes Int    // Needs review

  status          String    @default("draft") // "draft" | "in_review" | "approved"

  allocations     Allocation[]
  timesheet       Timesheet?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, date])
  @@index([userId, date])
}

// ─── ALLOCATION ───

model Allocation {
  id              String    @id @default(cuid())
  workSessionId   String
  workSession     WorkSession @relation(fields: [workSessionId], references: [id], onDelete: Cascade)

  startTime       DateTime
  endTime         DateTime
  durationMinutes Int

  // What was allocated
  allocationType  String    // "work_item" | "meeting" | "pr_review"
                            // | "general_engineering" | "admin" | "unallocated"
  workItemId      String?
  workItem        WorkItem? @relation(fields: [workItemId], references: [id])
  title           String    // Display title
  description     String?

  // Confidence
  confidence      Float     // 0.0 to 1.0
  confidenceLevel String    // "high" | "medium" | "needs_review"

  // State
  status          String    @default("suggested") // "suggested" | "approved" | "edited" | "split" | "merged"
  isUserModified  Boolean   @default(false)
  sortOrder       Int       @default(0)

  evidence        AllocationEvidence[]
  correction      UserCorrection?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([workSessionId, startTime])
}

model AllocationEvidence {
  id              String    @id @default(cuid())
  allocationId    String
  allocation      Allocation @relation(fields: [allocationId], references: [id], onDelete: Cascade)

  normalizedEventId String
  normalizedEvent   NormalizedEvent @relation(fields: [normalizedEventId], references: [id])

  evidenceType    String    // "direct_reference" | "branch_match" | "temporal_overlap"
                            // | "repository_match" | "calendar_match" | "commit_message"
                            // | "pr_relationship" | "issue_activity"
  strength        Float     // 0.0 to 1.0 — how strong this evidence is
  explanation     String    // Human-readable: "Commit abc123 references BUG-442"

  @@index([allocationId])
}

// ─── USER CORRECTIONS ───

model UserCorrection {
  id              String    @id @default(cuid())
  allocationId    String    @unique
  allocation      Allocation @relation(fields: [allocationId], references: [id], onDelete: Cascade)

  correctionType  String    // "reassign" | "split" | "merge" | "confirm" | "delete"
  originalData    Json      // Snapshot of original allocation
  correctedData   Json      // What the user changed to

  createdAt       DateTime  @default(now())
}

model UserLearning {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  learningType    String    // "meeting_project" | "repo_project" | "branch_workitem"
                            // | "calendar_category" | "work_pattern"
  pattern         String    // The pattern: e.g., "standup" | "repo:frontend"
  resolution      String    // What it maps to: e.g., "project:alpha" | "admin"
  confidence      Float     @default(1.0)
  occurrences     Int       @default(1)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, learningType, pattern])
}

// ─── TIMESHEET ───

model Timesheet {
  id              String    @id @default(cuid())
  workSessionId   String    @unique
  workSession     WorkSession @relation(fields: [workSessionId], references: [id])

  userId          String
  date            DateTime  @db.Date
  totalMinutes    Int
  status          String    @default("approved") // "approved" | "exported"

  entries         TimesheetEntry[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, date])
}

model TimesheetEntry {
  id              String    @id @default(cuid())
  timesheetId     String
  timesheet       Timesheet @relation(fields: [timesheetId], references: [id], onDelete: Cascade)

  workItemKey     String?   // e.g., "BUG-442"
  project         String?   // e.g., "Project Alpha"
  description     String
  durationMinutes Int
  billable        Boolean   @default(true)
  category        String?   // "development" | "meeting" | "review" | "admin" | "other"
}
```

### Schema Design Rationale

1. **NormalizedEvent is the central evidence store**: All integrations normalize into this table. The allocation engine never touches raw API data — only normalized events.

2. **WorkItem is integration-agnostic**: Both Jira issues and GitHub issues/PRs become WorkItems. The `provider` + `externalId` compound key prevents duplicates.

3. **Allocation is separate from evidence**: An allocation *references* evidence but is not evidence itself. This allows the AI to propose allocations that the user can override without losing the underlying evidence.

4. **UserCorrection preserves original + corrected**: This enables the learning system to understand *what changed* and build future patterns.

5. **UserLearning is explicit, inspectable, reversible**: Not a black-box ML model. Users can see and delete learned patterns.

6. **PrivacySettings at org level**: Organizations control what data is collected and who sees what.

7. **Encrypted tokens**: Integration access/refresh tokens stored encrypted.

---

## 5. API Design

### API Routes (Next.js App Router)

All API routes under `/api/`. Authentication via session cookie (NextAuth).

#### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/[...nextauth]` | NextAuth handler (login, OAuth callbacks) |
| GET | `/api/auth/session` | Get current session |

#### Integrations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations` | List user's integrations |
| GET | `/api/integrations/[provider]/connect` | Initiate OAuth flow |
| GET | `/api/integrations/[provider]/callback` | OAuth callback |
| POST | `/api/integrations/[provider]/sync` | Trigger manual sync |
| DELETE | `/api/integrations/[provider]` | Disconnect integration |
| GET | `/api/integrations/[provider]/status` | Sync status |

#### Timeline
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/timeline?date=YYYY-MM-DD` | Get/generate workday timeline |
| POST | `/api/timeline/reconstruct` | Force reconstruction for a date |

#### Allocations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/allocations?sessionId=X` | Get allocations for a session |
| PATCH | `/api/allocations/[id]` | Edit allocation (reassign, change duration) |
| POST | `/api/allocations/[id]/approve` | Approve an allocation |
| POST | `/api/allocations/[id]/split` | Split allocation into two |
| POST | `/api/allocations/merge` | Merge two adjacent allocations |
| GET | `/api/allocations/[id]/evidence` | Get evidence for allocation |

#### Work Items
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/work-items?search=X` | Search work items (for reassignment) |

#### Timesheets
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/timesheets` | Create timesheet from approved session |
| GET | `/api/timesheets?date=YYYY-MM-DD` | Get timesheet for date |
| GET | `/api/timesheets/[id]/export` | Export CSV |

#### Review
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/review/summary?date=YYYY-MM-DD` | End-of-day summary |
| POST | `/api/review/submit` | Submit reviewed day |

### API Response Shape

```typescript
// Standard API response
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Allocation response
interface AllocationResponse {
  id: string;
  startTime: string;  // ISO 8601
  endTime: string;
  durationMinutes: number;
  allocationType: AllocationType;
  workItemKey?: string;
  title: string;
  description?: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'needs_review';
  status: AllocationStatus;
  isUserModified: boolean;
  evidence: EvidenceItem[];
}

interface EvidenceItem {
  type: string;
  strength: number;
  explanation: string;
  sourceUrl?: string;
}
```

---

## 6. Integration Strategy

### OAuth Flow (All Providers)

```
User clicks "Connect Jira"
    → Frontend redirects to /api/integrations/jira/connect
    → Server builds OAuth URL with correct scopes
    → User authorizes in provider
    → Provider redirects to /api/integrations/jira/callback
    → Server exchanges code for tokens
    → Tokens encrypted and stored in Integration table
    → User redirected back to settings page
```

### Jira Cloud Integration

**Auth**: OAuth 2.0 (3LO) via Atlassian Connect
**Scopes**: `read:jira-work`, `read:jira-user`
**Data collected**:
- Projects (key, name)
- Issues (key, summary, description, status, assignee, type, project)
- Issue transitions/activity (status changes with timestamps)
- Comments (where user is author — for context)
- Worklogs (existing time entries)

**Sync strategy**:
- Initial sync: Fetch all issues assigned to user or where user has activity, last 30 days
- Incremental sync: JQL `updated >= -1d` on subsequent syncs
- Polling interval: Every 15 minutes via BullMQ job (MVP)

**Normalization examples**:
| Jira Event | → NormalizedEvent |
|-----------|-------------------|
| Issue status change to "In Progress" | `eventType: "issue_updated"`, title: "Started AUTH-231" |
| Comment added | `eventType: "issue_commented"`, title: "Commented on BUG-442" |
| Worklog added | `eventType: "worklog"`, with duration |

### GitHub Integration

**Auth**: GitHub OAuth App
**Scopes**: `repo` (read access to commits, PRs, branches)
**Data collected**:
- Repositories (user has access to)
- Commits (author = user, last 30 days)
- Pull requests (author = user or reviewer = user)
- PR reviews (by user)
- Branches (active, with naming patterns like `feature/AUTH-231`)

**Sync strategy**:
- Initial sync: Commits + PRs from last 30 days across selected repos
- Incremental sync: Since last sync timestamp
- Polling interval: Every 15 minutes

**Jira linking heuristic**:
1. Branch name contains Jira key (e.g., `feature/AUTH-231-login`)
2. Commit message contains Jira key (e.g., `fix: resolve AUTH-231 token issue`)
3. PR title/body contains Jira key

**Normalization examples**:
| GitHub Event | → NormalizedEvent |
|-------------|-------------------|
| Commit | `eventType: "commit"`, title: "fix: resolve token issue", metadata: {sha, repo, branch} |
| PR opened | `eventType: "pr_opened"`, title: "PR #42: Auth flow", metadata: {prNumber, repo} |
| PR review submitted | `eventType: "pr_review"`, title: "Reviewed PR #38" |

### Google Calendar Integration

**Auth**: Google OAuth 2.0
**Scopes**: `https://www.googleapis.com/auth/calendar.events.readonly`
**Data collected**:
- Calendar events within working hours (or configurable range)
- Event title, start/end time, attendees (if permitted by org privacy settings)
- Calendar name (for project context inference)

**Sync strategy**:
- Fetch events for target date range
- No incremental sync needed — just re-fetch for the dates being reconstructed

**Normalization examples**:
| Calendar Event | → NormalizedEvent |
|---------------|-------------------|
| "Team Standup" 09:30-10:00 | `eventType: "calendar_event"`, duration: 30, title: "Team Standup" |
| "Sprint Planning" 14:00-15:30 | `eventType: "calendar_event"`, duration: 90, title: "Sprint Planning" |

### Mock Data Strategy

Every connector has a mock mode:
```typescript
interface Connector {
  fetchWorkItems(userId: string, since: Date): Promise<WorkItem[]>;
  fetchEvents(userId: string, since: Date): Promise<NormalizedEvent[]>;
}

class JiraConnector implements Connector { /* real API */ }
class MockJiraConnector implements Connector { /* synthetic data */ }
```

This allows development and testing without live OAuth tokens.

---

## 7. AI Pipeline

### Pipeline Architecture

The pipeline is intentionally structured to minimize LLM usage. LLMs are expensive, slow, and non-deterministic. Use them only where they add value.

```
Step 1: GATHER (Deterministic)
   └─ Fetch NormalizedEvents for user + date

Step 2: TEMPORAL GROUPING (Deterministic)
   └─ Group events into time clusters
   └─ Identify gaps
   └─ Identify calendar events (fixed anchors)

Step 3: CANDIDATE GENERATION (Deterministic)
   └─ For each time segment, identify candidate WorkItems
   └─ Use: direct references, branch names, temporal proximity

Step 4: EVIDENCE SCORING (Deterministic)
   └─ Score each candidate with weighted evidence
   └─ Apply user learnings

Step 5: ALLOCATION (Deterministic where possible)
   └─ If top candidate has confidence >= 0.80 → allocate
   └─ If gap between top two < 0.15 → mark as "needs_review"

Step 6: AI REASONING (LLM — only for ambiguous cases)
   └─ Send ambiguous segments to LLM with:
       - Candidate work items + evidence
       - Temporal context
       - User's recent work patterns
   └─ LLM returns: preferred allocation + reasoning

Step 7: CONFIDENCE CALCULATION (Deterministic)
   └─ Combine evidence scores + AI reasoning
   └─ Produce final confidence per allocation

Step 8: ASSEMBLY (Deterministic)
   └─ Build WorkSession with all Allocations
   └─ Calculate summary stats
```

### When to use LLM vs Deterministic

| Scenario | Approach |
|----------|----------|
| Commit message mentions "AUTH-231" | Deterministic: regex match |
| Branch named `feature/AUTH-231` | Deterministic: regex match |
| Calendar event "Team Standup" | Deterministic: calendar event = meeting |
| PR review by user | Deterministic: PR review allocation |
| 45 min gap with no events | LLM: "What was the user likely doing given surrounding context?" |
| 2 competing work items with similar evidence | LLM: "Which is more likely given the narrative of the day?" |
| Meeting title "Weekly Sync" — which project? | LLM + UserLearning: check learned mappings first, then ask LLM |

### LLM Prompt Design (Ambiguous Allocation)

```typescript
const prompt = `
You are a timesheet assistant helping a software developer reconstruct their workday.

Given the following context for a ${durationMinutes}-minute period
(${startTime} to ${endTime}):

CANDIDATE WORK ITEMS:
${candidates.map(c => `
- ${c.workItemKey}: ${c.title}
  Evidence: ${c.evidence.join(', ')}
  Score: ${c.score}
`).join('\n')}

SURROUNDING CONTEXT:
- Before this period: ${beforeContext}
- After this period: ${afterContext}
- User's active branches: ${activeBranches}
- Recent Jira activity: ${recentJiraActivity}

USER'S LEARNED PREFERENCES:
${learnings.map(l => `- ${l.pattern} → ${l.resolution}`).join('\n')}

Respond with JSON:
{
  "allocation": "WORK_ITEM_KEY or MEETING or UNALLOCATED",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}

Rules:
- If you cannot determine with >50% confidence, respond with "UNALLOCATED"
- Do NOT fabricate evidence
- "No commits" does NOT mean "no work"
- Prefer the simplest explanation
`;
```

### Temporal Grouping Algorithm

```
Input: Sorted list of NormalizedEvents for the day

1. Start with user's configured workday (e.g., 09:00–17:30)

2. Calendar events are ANCHORS — they create fixed time blocks

3. For non-calendar events (commits, PR activity, Jira updates):
   a. If events are within 15 minutes of each other → same cluster
   b. If gap > 30 minutes → potential break or context switch

4. For each cluster:
   a. Start time = earliest event - 5 min buffer (or start of workday)
   b. End time = latest event + 5 min buffer (or next anchor)
   c. Don't overlap with calendar events

5. Gaps between clusters:
   a. < 15 min → merge with adjacent cluster
   b. 15-60 min → check if there's a likely work item (continuation)
   c. > 60 min → mark as potential break or unallocated

6. Result: List of TimeSegments, each with:
   - startTime, endTime
   - events[]
   - isCalendarAnchored: boolean
   - gap: boolean
```

---

## 8. Confidence Model

### Signal Weights

Confidence is NOT a random number. It's a weighted sum of evidence signals.

| Signal | Weight | Description |
|--------|--------|-------------|
| `direct_jira_reference` | 0.30 | Commit/branch/PR directly references Jira key |
| `repository_match` | 0.15 | Activity in repo known to be associated with project |
| `branch_match` | 0.20 | Active branch matches work item pattern |
| `temporal_overlap` | 0.10 | Activity occurs during a period when the work item was "In Progress" |
| `commit_message_match` | 0.15 | Commit message keywords match work item title/description |
| `calendar_match` | 0.25 | Calendar event directly corresponds (for meetings) |
| `pr_relationship` | 0.20 | PR linked to issue or reviews |
| `issue_activity` | 0.15 | Jira comments, status changes during period |
| `user_learning` | 0.20 | User has previously confirmed this mapping |
| `continuity` | 0.10 | Same work item before/after this period |

### Confidence Calculation

```typescript
function calculateConfidence(signals: Signal[]): { score: number; level: string } {
  // Sum weighted signals (capped at 1.0)
  let raw = signals.reduce((sum, s) => sum + s.weight * s.strength, 0);
  let score = Math.min(raw, 1.0);

  // Penalize if competing candidates exist
  // If the second-best candidate is within 0.15, reduce confidence
  if (competingCandidate && (score - competingScore) < 0.15) {
    score *= 0.7; // Significant penalty
  }

  // Apply user learning bonus
  if (hasUserLearning) {
    score = Math.min(score + 0.15, 1.0);
  }

  const level = score >= 0.80 ? 'high'
              : score >= 0.50 ? 'medium'
              : 'needs_review';

  return { score: Math.round(score * 100) / 100, level };
}
```

### Confidence Levels for UI

| Level | Score Range | UI Treatment |
|-------|-----------|--------------|
| High | ≥ 0.80 | Green indicator, can be bulk-approved |
| Medium | 0.50 – 0.79 | Yellow indicator, review suggested |
| Needs Review | < 0.50 | Red indicator, must be reviewed |
| Unallocated | N/A | Gray, explicitly needs user input |

---

## 9. Security Model

### Authentication
- Email + bcrypt-hashed password
- Session-based auth via NextAuth.js (httpOnly, secure cookies)
- CSRF protection via NextAuth's built-in mechanisms
- No JWT tokens exposed to client

### OAuth Token Storage
- Access tokens and refresh tokens encrypted at rest using AES-256
- Encryption key from environment variable, never committed
- Tokens scoped to minimum required permissions

### Authorization
- All API routes require authenticated session
- Users can only access their own data (userId check on every query)
- No admin/manager views in MVP (only self-service)

### Data Security
- HTTPS enforced in production
- Database connection via SSL
- No sensitive data in client-side logs
- API rate limiting (planned, not MVP-critical for single-user)

### Input Validation
- Zod schemas for all API inputs
- Parameterized queries (Prisma handles this)
- No raw SQL

---

## 10. Privacy Model

### Data Minimization Principles

1. **Collect minimum necessary**: We don't need full file diffs, only commit metadata
2. **No content scraping**: We don't read code content, only commit messages and PR titles
3. **Calendar**: Titles + times only. Attendees only if org permits.
4. **No screenshots, keystrokes, mouse tracking**: Architecturally impossible — not just disabled

### Data Classification

| Data | Classification | Retention |
|------|---------------|-----------|
| User profile | Personal | Until account deletion |
| OAuth tokens | Secret | Until disconnection + 24h |
| NormalizedEvents | Work evidence | Configurable (default 90 days) |
| Allocations | Work record | Configurable (default 1 year) |
| Timesheets | Financial record | Configurable (default 2 years) |
| UserCorrections | Learning data | Configurable (default 1 year) |
| UserLearnings | Preference data | Until user deletes or resets |

### Organizational Controls (Future)

- Toggle integrations on/off
- Set data retention periods
- Control manager visibility
- Disable attendee collection
- Export/delete all user data

### LLM Data Handling

- Only anonymized work item titles and temporal data sent to LLM
- No PII in LLM prompts (no email addresses, no attendee names)
- No code content sent to LLM
- LLM responses not stored as training data

---

## 11. Testing Strategy

### Test Pyramid

```
         E2E (Playwright)
        ┌────────────────┐
        │  5-10 tests    │  Full user flows
        │  (Critical     │
        │   paths only)  │
        └────────────────┘
       Integration Tests
      ┌──────────────────┐
      │  30-50 tests     │  API routes, DB queries,
      │  (API + DB +     │  connector mock tests
      │   pipeline)      │
      └──────────────────┘
     Unit Tests (Vitest)
    ┌────────────────────┐
    │  100+ tests        │  Normalizer, timeline engine,
    │  (Pure functions,  │  allocation engine, confidence
    │   algorithms)      │  calculator, CSV export
    └────────────────────┘
```

### Synthetic Test Scenarios

Create fixture data for these developer workday patterns:

1. **Simple day**: 3 Jira tickets, commits with clear references, 1 meeting
2. **Multi-ticket**: 6+ tickets, frequent context switching
3. **Debug day**: Long debugging session (3h), no commits, Jira activity only
4. **Meeting-heavy**: 4+ meetings, minimal coding
5. **PR review day**: Reviewing others' PRs, code review comments
6. **Research day**: Few artifacts, scattered browser/documentation activity
7. **Mixed day**: Some Jira work, some meetings, some unallocated
8. **Ambiguous work**: Commits that could belong to 2+ tickets
9. **No evidence gaps**: 2+ hours with zero events
10. **Weekend work**: Saturday activity outside normal hours
11. **Timezone edge**: User in UTC+5:30, events span midnight UTC
12. **Missing API data**: Jira timeout, partial GitHub data
13. **Duplicate events**: Same commit appears in multiple sync runs
14. **Incorrect metadata**: Jira issue assigned to wrong project

### What to Assert

- Timeline covers configured working hours
- Calendar events become meeting allocations (confidence ≥ 0.90)
- Direct Jira references produce high confidence (≥ 0.80)
- Ambiguous periods get "needs_review" confidence
- Gaps are preserved as unallocated (not filled with hallucinated work)
- Split/merge operations maintain total duration
- CSV export matches approved allocations
- Timezone conversions are correct

---

## 12. Deployment Strategy

### MVP Deployment

```
Vercel (Next.js App)
   │
   ├── App + API routes
   │
   └── Server-side rendering
         │
         ▼
  Supabase (PostgreSQL)
         │
         └── Managed Postgres
               │
               ▼
  Upstash Redis (BullMQ)
         │
         └── Serverless Redis for job queue
```

**Alternative**: Railway for both Postgres + Redis if Supabase's free tier is limiting.

### Environment Variables

```
# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Database
DATABASE_URL=
DIRECT_URL=   # For Prisma migrations

# Encryption
TOKEN_ENCRYPTION_KEY=

# Jira OAuth
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Google Calendar OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GEMINI_API_KEY=

# Redis (BullMQ)
REDIS_URL=
```

### Deployment Checklist

- [ ] HTTPS enforced
- [ ] Environment variables set (no secrets in code)
- [ ] Database migrations run
- [ ] OAuth redirect URIs configured in Jira/GitHub/Google consoles
- [ ] CORS configured
- [ ] Error monitoring (Sentry — free tier)

---

## 13. Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Jira OAuth complexity** | High | Atlassian OAuth 2.0 (3LO) is notoriously complex. Test early. Have mock fallback. |
| **Insufficient evidence for allocation** | High | Accept uncertainty. Mark as unallocated. Don't hallucinate. |
| **LLM cost at scale** | Medium | Use LLM only for ambiguous cases (~20% of allocations). Cache similar patterns. |
| **LLM non-determinism** | Medium | Structure prompts for JSON output. Validate responses. Fall back to "needs_review" if LLM output is invalid. |
| **OAuth token refresh** | Medium | Implement token refresh logic per provider. Handle expired tokens gracefully. |
| **Timezone bugs** | Medium | Store everything in UTC. Convert at display. Test timezone edge cases specifically. |
| **Calendar spam** | Low | Filter out declined events, all-day events, OOO events. |
| **GitHub rate limits** | Low | Respect rate limits. Implement exponential backoff. 5000 req/hr is generous for MVP. |
| **Data consistency during sync** | Medium | Use database transactions. Idempotent sync operations. |
| **User trust** | High | Transparency is everything. Show evidence. Allow easy correction. Never fabricate. |

---

## 14. Self-Critique

### Assumptions I'm Challenging

1. **"Developers will connect all three integrations"**
   - Reality: Some may only connect GitHub. The system must still produce value with partial data.
   - Mitigation: Each integration independently contributes evidence. Graceful degradation.

2. **"15-minute sync polling is sufficient"**
   - Reality: For end-of-day reconstruction, yes. For real-time, no.
   - Mitigation: Manual "Sync Now" button for immediate refresh. Webhooks are Phase 2+.

3. **"Branch names follow Jira conventions"**
   - Reality: Many teams have no naming conventions. Some use `fix-login-bug` not `AUTH-231-fix-login`.
   - Mitigation: Use branch name matching as one signal, not the only one. UserLearning can map repos to projects.

4. **"Heuristic confidence is meaningful"**
   - Reality: Without training data, our 0.85 confidence is somewhat arbitrary.
   - Mitigation: Be transparent. Use "High/Medium/Needs Review" in UI rather than precise percentages. Calibrate post-dogfooding.

5. **"The LLM will reason correctly about work context"**
   - Reality: LLMs can hallucinate. They may confidently allocate to the wrong ticket.
   - Mitigation: LLM output is NEVER automatically accepted at high confidence. Always capped at 0.75 unless corroborated by deterministic evidence.

### Unnecessary Complexity I'm Avoiding

- No microservices — monolith is correct for MVP
- No event sourcing — CRUD with audit trail is sufficient
- No ML model training — heuristic confidence is fine for MVP
- No real-time collaboration — single-user review flow
- No GraphQL — REST is simpler for this use case
- No custom auth — NextAuth handles it

### What Will Be Insufficient

1. **Investigation work**: If a developer spends 3 hours debugging with no Jira/GitHub/Calendar activity, we have zero evidence. The system correctly marks this as unallocated, but the user must manually allocate. This is acceptable for MVP — the system doesn't claim to know what it can't know.

2. **Slack activity**: We don't integrate Slack. If a developer spends 2 hours helping teammates on Slack, this is invisible. Future integration.

3. **Terminal/IDE activity**: We don't monitor local development tools. A developer writing code for 2 hours without committing produces no evidence. This is a known gap, addressed by allowing temporal continuity ("you were working on AUTH-231 from 9-11, then 11-12 has no evidence but you committed AUTH-231 code at 12:15 — likely continuation").

4. **Multi-project ambiguity**: If a developer has 5 active Jira tickets across 2 projects and makes commits without clear references, the system will struggle. This is the exact case where LLM reasoning + user confirmation provides value.

### Integration Risks

- **Jira**: OAuth 2.0 (3LO) is the most complex OAuth implementation among the three. Atlassian's documentation has gaps. Risk: 2-3 days of integration debugging.
- **GitHub**: Well-documented OAuth. Low risk.
- **Google Calendar**: Well-documented OAuth. Medium risk (Google's OAuth consent screen review can block non-verified apps, but using "testing mode" is fine for MVP).

### Privacy Risks

- LLM prompts could leak work item titles. Mitigation: Use internal IDs + generic descriptions where possible.
- Calendar attendees could reveal organizational structure. Mitigation: Org can disable attendee collection.
- Commit messages could contain sensitive information. Mitigation: Don't display full commit messages to anyone but the user themselves.

---

## Appendix A: Type Definitions

```typescript
// Core types shared between frontend and backend

type Provider = 'jira' | 'github' | 'google_calendar';

type EventType =
  | 'commit'
  | 'pr_opened'
  | 'pr_merged'
  | 'pr_review'
  | 'issue_updated'
  | 'issue_commented'
  | 'worklog'
  | 'calendar_event'
  | 'branch_activity';

type AllocationType =
  | 'work_item'
  | 'meeting'
  | 'pr_review'
  | 'general_engineering'
  | 'admin'
  | 'unallocated';

type ConfidenceLevel = 'high' | 'medium' | 'needs_review';

type AllocationStatus = 'suggested' | 'approved' | 'edited' | 'split' | 'merged';

type WorkSessionStatus = 'draft' | 'in_review' | 'approved';

type CorrectionType = 'reassign' | 'split' | 'merge' | 'confirm' | 'delete';

type EvidenceType =
  | 'direct_reference'
  | 'branch_match'
  | 'temporal_overlap'
  | 'repository_match'
  | 'calendar_match'
  | 'commit_message'
  | 'pr_relationship'
  | 'issue_activity'
  | 'user_learning'
  | 'continuity';
```

---

## Appendix B: Implementation Phase Checklist

See [TODO.md](file:///C:/Users/KaransPC/Downloads/Freelance/Timesheet%20Automation/TODO.md) for detailed implementation tasks.
