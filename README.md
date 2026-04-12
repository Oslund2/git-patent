# Git-Patent

Most software never gets patented — not because it isn't novel, but because the process is expensive, slow, and opaque. Developers build genuinely inventive systems every day, ship them to production, and move on. Meanwhile, the innovations buried in that code go unprotected.

Git-Patent changes that. Point it at a GitHub repo or upload a ZIP of your source code, and it does the rest. The platform uses AI to read your codebase the way a patent attorney would — identifying novel algorithms, unique architectural patterns, and inventive data structures that qualify for IP protection. It then generates complete, USPTO-ready patent applications: specifications written in proper patent language, independent and dependent claims, technical drawings, prior art searches against real patents, novelty analysis, CPC classifications, and all the filing forms.

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
- **Multi-dimensional novelty analysis** — AI scores four patent dimensions (35 USC 102 Novelty, 35 USC 103 Non-Obviousness, Technical Depth, and Prior Art Differentiation) each with 0-100 scores and reasoning, blended with a heuristic safety net for calibrated results
- **README-grounded scoring** — the analyzed repo's README serves as structured ground truth in scoring prompts, letting the AI compare the inventor's claimed functionality against extracted code features and prior art
- **Independent approval probability** — five-factor model (novelty foundation, prior art landscape, specification completeness, Alice/101 eligibility, assessment quality) replaces simple novelty-derived estimates
- **Patent strength composite** — multi-factor model weighting novelty, approval probability, non-obviousness, technical depth, and prior art differentiation when AI dimensions are available
- **Differentiation analysis** — points of novelty, technical advantages, feature comparison matrix, design-around strategies, and non-obviousness arguments
- **CPC classification** — AI-suggested Cooperative Patent Classification codes with confidence scores
- **USPTO forms** — SB-16 Provisional Cover Sheet, Application Data Sheet (ADS), declaration forms, and micro-entity certification
- **Filing fee calculator** — 2024 USPTO rates for provisional, non-provisional, continuation, CIP, and divisional filings with regular/small/micro-entity discounts and excess claims fees
- **Filing types** — provisional, non-provisional, continuation, continuation-in-part (CIP), and divisional applications
- **PDF export** — generate patent documents with jsPDF

### One-Click Patent Generation
The auto-orchestrator clusters your codebase features into patentable innovations and generates complete patent applications in a single pipeline with real-time progress reporting.

### Authentication & Payments
- **Sign-in required** — all users must create an account (email/password via Supabase Auth)
- **Internal user bypass** — `@scripps.com` employees get free, unlimited access (configurable domain allowlist)
- **Stripe Checkout** — external users pay a one-time $49 fee per project via Stripe-hosted checkout
- **Webhook-driven** — payment confirmation is handled server-side via Stripe webhooks with signature verification
- **Audit trail** — every payment is logged in a `payments` table with Stripe session and payment intent IDs
- **Post-payment flow** — after Stripe checkout, users return to the app and proceed directly to analysis without re-payment

### Terms of Service
- Built-in TOS page accessible from every screen (footer link on all pages, consent notice on login/signup)
- AI-generated content disclaimer, hold-harmless/indemnification, limitation of liability, warranty disclaimer
- Users are advised to consult a licensed patent attorney before filing

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
Core AI engine powering all generation tasks — specifications, claims, multi-dimensional novelty analysis, feature extraction, CPC classification, and more. Feature-specific token limits range from 2,048 to 8,192. The novelty analysis prompt requests structured scoring across four patent dimensions with calibrated anchors and README-grounded evaluation.

- **Env var:** `ANTHROPIC_API_KEY` (set in Netlify environment, never shipped to browser)

### Serper.dev (Google Patents)
Real patent prior art search via the `search-patents` Netlify function. Returns patent numbers, titles, snippets, filing dates, inventors, assignees, and thumbnails.

- **Endpoint:** `https://google.serper.dev/patents`
- **Env var:** `SERPER_API_KEY` (set in Netlify environment)

### GitHub API
Fetches repository metadata, file trees, and file contents for codebase analysis via the `github-proxy` Netlify function. Authenticated via `GITHUB_TOKEN` for 5,000 requests/hour (vs 60/hour unauthenticated).

- **Env var:** `GITHUB_TOKEN` (set in Netlify environment, never shipped to browser)

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
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_INTERNAL_DOMAINS=yourcompany.com
```

Set these in your **Netlify environment variables** (not in `.env` — they are server-side only):

```
ANTHROPIC_API_KEY=sk-ant-...   # Anthropic Claude API key
GITHUB_TOKEN=ghp_...           # GitHub PAT for higher API rate limits (optional but recommended)
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
    legal/           # TermsOfService
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

- **Email/password** — standard Supabase auth (required for all users)
- **Internal domains** — `@scripps.com` users get free access; configurable via `VITE_INTERNAL_DOMAINS`
- **External users** — must pay via Stripe before running the analysis pipeline

## License

Private
