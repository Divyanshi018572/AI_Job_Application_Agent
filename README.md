# AI Job Application Agent 🚀

An autonomous AI-powered assistant designed to streamline job discovery, application tracking, and resume optimization. Built with Next.js 16, Supabase, and AI agents.

## ✨ Features
- **Job Application Dashboard**: Manage and track application stages (`draft`, `applied`, `interviewing`, `offer`).
- **Supabase Authentication & Row-Level Security**: Secure user profiles and applications using PostgreSQL Row-Level Security (RLS).
- **Automated AI Reviews**: Integrated with CodeRabbit for automated pull request code reviews.

## 🛠️ Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Shadcn UI
- **Backend & Database**: Supabase (PostgreSQL 17 + Row-Level Security)
- **CI/CD & Code Quality**: CodeRabbit AI Reviewer

## 🚀 Getting Started

### 1. Configure Environment Variables
Copy `.env.example` to `.env.local` and populate your Supabase credentials:
```bash
cp .env.example .env.local
```

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the app.
