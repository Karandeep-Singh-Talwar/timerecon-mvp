# TimeRecon — AI Workday Reconstruction & Timesheet Automation

An AI workday reconstruction product for software engineering teams. Reconstructs workdays from Jira, GitHub, and Google Calendar activity into accurate timesheet entries.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Server Actions)
- **Database:** Neon Postgres (Serverless) + Prisma ORM
- **AI Engine:** Gemini 2.0 Flash API
- **Background Jobs:** BullMQ + ioredis
- **Authentication:** NextAuth.js (Auth.js v5)
- **UI:** Custom CSS Design System (Journal Aesthetic, Dark Mode)

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in your database credentials:
```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXTAUTH_SECRET=your-secret
```

### 3. Run Migrations & Seed Data
```bash
npx prisma generate
npx prisma db push
```

### 4. Start Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Deployment
Hosted on Vercel: [https://timerecon-mvp.vercel.app](https://timerecon-mvp.vercel.app)
