# Git-Patent

Most software never gets patented — not because it isn't novel, but because the process is expensive, slow, and opaque. Developers build genuinely inventive systems every day, ship them to production, and move on. Meanwhile, the innovations buried in that code go unprotected.

Git-Patent changes that. Point it at a GitHub repo or upload a ZIP of your source code, and it does the rest. The platform uses AI to read your codebase the way a patent attorney would — identifying novel algorithms, unique architectural patterns, and inventive data structures that qualify for IP protection. It then generates complete, USPTO-ready patent applications: specifications written in proper patent language, independent and dependent claims, technical drawings, prior art searches against real patents, novelty analysis, CPC classifications, and all the filing forms.

It handles copyrights and trademarks too. One click can take an entire codebase from raw source to a portfolio of IP filings.

The goal is simple: if you wrote something worth protecting, the paperwork shouldn't be the reason you don't.

## Features

### Codebase Analysis
- **GitHub integration** — paste a repo URL to fetch and analyze source code via the GitHub API
- **ZIP upload** — drag-and-drop a ZIP archive of your project
- **AI-powered feature extraction** — identifies algorithms, data structures, integrations, UI patterns, optimizations, architecture, API design, and security mechanisms
- **Novelty assessment** — rates each feature as strong, moderate, or weak for patentability
- **Batch processing** — analyzes up to ~40 files in batches of 8

### Patent Application Generation
- **Full specification authoring** — Field of Invention, Background, Summary, Detailed Description, and Abstract sections generated via AI
- **Claims generation** — independent claims (method, system, computer-readable medium) and 8-15 dependent claims following USPTO requirements
- **Patent drawings** — system architecture diagrams, algorithm flowcharts, data structure diagrams, integration diagrams, workflow diagrams, UI wireframes, and block diagrams in print-optimized SVG
- **Prior art search** — two-phase search using the Serper API (Google Patents) followed by AI relevance analysis, similarity scoring, and blocking risk assessment
- **Novelty analysis** — overall novelty score (0-100), feature-by-feature breakdown, approval probability estimation, and recommendations
- **Differentiation analysis** — points of novelty, technical advantages, feature comparison matrix, design-around strategies, and non-obviousness arguments
- **CPC classification** — AI-suggested Cooperative Patent Classification codes with confidence scores
- **USPTO forms** — SB-16 Provisional Cover Sheet, Application Data Sheet (ADS), declaration forms, and micro-entity certification
- **Filing fee calculator** — 2024 USPTO rates for provisional, non-provisional, continuation, CIP, and divisional filings with regular/small/micro-entity discounts and excess claims fees
- **Filing types** — provisional, non-provisional, continuation, continuation-in-part (CIP), and divisional applications
- **PDF export** — generate patent documents with jsPDF

### Copyright Registration
- **Registration types** — source code, module, library, application, collection
- **Work types** — literary work, compilation, audiovisual, sound recording
- **AI authorship disclosure** — track AI contribution percentage, tools used, and human authorship statements
- **Author types** — individual, work-for-hire, joint, collective, anonymous, pseudonymous
- **Bulk registration** — batch registration for multiple works
- **International support** — international copyright registration

### Trademark Filing
- **Mark types** — word mark, design mark, combined mark, sound mark, motion mark
- **Filing basis** — use in commerce, intent to use, foreign registration, foreign application
- **International classes** — WIPO classification support
- **Specimen management** — product labels, packaging, website screenshots, advertisements, brochures
- **Full lifecycle tracking** — draft through registered/abandoned status

### One-Click IP Generation
The auto-orchestrator clusters your codebase features into patentable innovations and generates patent applications, copyright registrations, and trademark filings in a single pipeline with progress reporting.

### Payments & Access Control
- **Internal user bypass** — employees at configured email domains get free, unlimited access
- **Stripe Checkout** — external users pay a one-time fee per project via Stripe-hosted checkout
- **Webhook-driven** — payment confirmation is handled server-side via Stripe webhooks with signature verification
- **Audit trail** — every payment is logged in a `payments` table with Stripe session and payment intent IDs
- **Test mode** — full demo flow using Stripe test keys and test card numbers (no real charges)

### Embeddable Widget
Git-Patent ships as both a standalone app and an embeddable React component:

```js
import { GitPatentWidget } from 'git-patent';

<GitPatentWidget
  supabaseUrl="..."
  supabaseAnonKey="..."
  geminiApiKey="..."
  userId="..."
  theme="light"
  initialView="projects"
  onPatentGenerated={(patent) => {}}
  onAnalysisComplete={(project) => {}}
/>
```

Build with `npm run build:lib` — outputs `dist-lib/git-patent.es.js`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 3.4 |
| Build | Vite 8, PostCSS, Autoprefixer |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Patent Search | Serper.dev (Google Patents API) |
| Code Ingestion | GitHub REST API |
| Payments | Stripe (Checkout Sessions, Webhooks) |
| PDF Generation | jsPDF |
| ZIP Handling | JSZip |
| Icons | Lucide React |
| Hosting | Netlify (SPA + serverless functions) |

## API Integrations

### Anthropic Claude API
Core AI engine powering all generation tasks — specifications, claims, novelty analysis, feature extraction, CPC classification, and more. Feature-specific token limits range from 2,048 to 8,192.

- **Env var:** `VITE_ANTHROPIC_API_KEY`

### Serper.dev (Google Patents)
Real patent prior art search via the `search-patents` Netlify function. Returns patent numbers, titles, snippets, filing dates, inventors, assignees, and thumbnails.

- **Endpoint:** `https://google.serper.dev/patents`
- **Env var:** `SERPER_API_KEY` (set in Netlify environment)

### GitHub API
Fetches repository metadata, file trees, and file contents for codebase analysis. Supports multiple URL formats and authenticated access for higher rate limits.

### Supabase
PostgreSQL database with Row-Level Security for all user data — projects, patent applications, claims, drawings, prior art results, novelty analyses, copyright registrations, trademark applications, and payment records.

- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Server-side:** `SUPABASE_SERVICE_ROLE_KEY` (set in Netlify env, used by webhook function)

### Stripe
One-time payments via Checkout Sessions. Internal users (configurable email domain allowlist) bypass payment entirely. Webhooks confirm payment and update project status.

- **Env vars (Netlify):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
- **Env vars (client):** `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_INTERNAL_DOMAINS`

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- An Anthropic API key
- A Serper.dev API key (for prior art search)

### Setup

```bash
git clone https://github.com/Oslund2/git-patent.git
cd git-patent
npm install
cp .env.example .env
```

Add your keys to `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ANTHROPIC_API_KEY=your-anthropic-key
VITE_INTERNAL_DOMAINS=yourcompany.com
```

Set these in your **Netlify environment variables** (not in `.env` — they are server-side only):

```
SERPER_API_KEY=...              # Prior art search (Serper.dev)
STRIPE_SECRET_KEY=sk_test_...  # Stripe API secret key
STRIPE_WEBHOOK_SECRET=whsec_...# Stripe webhook signing secret
STRIPE_PRICE_ID=price_...      # Stripe Price ID for the product
SUPABASE_SERVICE_ROLE_KEY=...  # Supabase service role key (for webhook)
INTERNAL_DOMAINS=yourcompany.com  # Free access email domains
```

### Database

Apply the migration to your Supabase project:

```bash
supabase db push
```

Or run the migration files directly in the Supabase SQL editor:
1. `supabase/migrations/001_initial_schema.sql` — core tables with RLS policies
2. `supabase/migrations/002_add_payments.sql` — payment tracking tables and indexes

### Development

```bash
npm run dev
```

### Build

```bash
# Standalone app
npm run build

# Embeddable library
npm run build:lib
```

### Deploy

Deploys to Netlify out of the box — `netlify.toml` is preconfigured with the build command, publish directory, functions directory, and SPA redirect rules.

## Project Structure

```
src/
  components/
    analysis/        # CodebaseUpload, ProjectList, AnalysisResults
    auth/            # LoginPage, SignUpPage
    embed/           # GitPatentWidget (embeddable)
    ip/              # IPDashboard, PatentApplication, CopyrightApplication, TrademarkApplication
      patent/        # 11 patent tabs (Overview, Abstract, Specification, Claims, Drawings, PriorArt, Analysis, LegalBrief, Filing, Applicant, Export, SB16FormWizard)
    payment/         # PaymentGate, PaymentBanner (Stripe integration)
    results/         # IPAnalysisDashboard, PatentDocumentViewer, FilingGuide
  contexts/          # AuthContext, ProjectContext
  hooks/             # usePaymentGate (Stripe payment flow)
  services/
    ai/              # geminiService, promptResolver, aiRequestService
    analysis/        # codebaseAnalysisEngine, codebaseIngestionService, githubService
    copyright/       # copyrightApplicationService, aiAuthorshipService, bulkCopyrightRegistration, internationalCopyright
    orchestration/   # ipAutoOrchestrator (one-click IP generation)
    patent/          # 20+ services: claims, specification, drawings, prior art, novelty, differentiation, CPC classification, USPTO forms, fee calculation, workflow orchestration
    trademark/       # trademarkApplicationService
  lib/               # supabase client, database types
  types/             # TypeScript type definitions
netlify/
  functions/         # search-patents, create-checkout, stripe-webhook, check-payment
supabase/
  migrations/        # 001_initial_schema.sql, 002_add_payments.sql
```

## Authentication

- **Email/password** — standard Supabase auth
- **GitHub OAuth** — sign in with GitHub
- **Guest mode** — explore the app without an account (uses a stable guest user ID)

## License

Private
