# TimeRecon — AI Workday Reconstruction & Timesheet Automation

An AI workday reconstruction product for software engineering teams. Reconstructs workdays from Jira, GitHub, and Google Calendar activity into accurate timesheet entries.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Database:** Neon Postgres + Prisma ORM
- **AI Engine:** Gemini 2.0 Flash API (ambiguous segments only)
- **Background Jobs:** Temporal (`USE_TEMPORAL=true`) — BullMQ legacy only
- **Authentication:** NextAuth.js (Auth.js v5)
- **UI:** Custom CSS (journal aesthetic)

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in database + secrets.

### 3. Run Migrations & Generate Client
```bash
npx prisma generate
npx prisma db push
```

### 4. Start Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 5. Tests
```bash
npm test
```

### 6. Temporal jobs (optional)
```bash
# Install Temporal CLI, then:
temporal server start-dev
npm run worker
# Set USE_TEMPORAL=true in .env
```

### Demo data
After login, use **Seed demo** (or `POST /api/demo/seed`) for a 5-day synthetic workweek.
