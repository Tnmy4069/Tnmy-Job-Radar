# Tnmy Job Radar — System Documentation

> **Version:** 0.1.0 · **Framework:** Next.js 16.3.4 (Turbopack) · **Database:** MongoDB (Prisma ORM) · **AI:** Google Gemini · **Deployment:** Vercel

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema (Prisma / MongoDB)](#5-database-schema-prisma--mongodb)
6. [Environment Variables](#6-environment-variables)
7. [Server Startup & Instrumentation](#7-server-startup--instrumentation)
8. [Source Adapter System](#8-source-adapter-system)
9. [Scanner Engine](#9-scanner-engine)
10. [Discovery Layer](#10-discovery-layer)
11. [Relevance Engine (Rule-Based Scoring)](#11-relevance-engine-rule-based-scoring)
12. [AI Intelligence Layer (Gemini)](#12-ai-intelligence-layer-gemini)
13. [Search System](#13-search-system)
14. [Authentication & Authorization](#14-authentication--authorization)
15. [API Routes](#15-api-routes)
16. [Frontend (React / Next.js Pages)](#16-frontend-react--nextjs-pages)
17. [Deployment (Vercel)](#17-deployment-vercel)
18. [CLI Scripts](#18-cli-scripts)
19. [Testing](#19-testing)
20. [Data Flow Diagrams](#20-data-flow-diagrams)

---

## 1. Project Overview

**Tnmy Job Radar** is a personal job tracking system that automatically discovers software engineering roles from **official company career pages** (not job boards), scores them for relevance to an early-career (0–2 years) software engineering profile, and ranks them using a two-layer intelligence system:

1. **Rule-based relevance scoring** — instant, deterministic title/skill/location/experience matching
2. **AI fit analysis** (Google Gemini) — deep semantic evaluation of job descriptions against a candidate profile

The system is designed as a **single-user / small-team** tool with a superadmin console for managing sources, scans, and user accounts.

### Key Capabilities

- Scans 100+ company career pages via pluggable ATS adapters (Greenhouse, Lever, Workday, etc.)
- Deduplicates, normalizes, and fingerprints jobs across scans
- Scores every job 0–100 with transparent match reasons
- Queues high-scoring jobs for Gemini AI deep-analysis (fit score, strengths, gaps, recommendation)
- Full-text search with token aliases (e.g., `ts` → `typescript`, `bangalore` ↔ `bengaluru`)
- Application tracking pipeline: unseen → saved → applied → interview → offer/rejected
- Admin dashboard with source health monitoring, Gemini telemetry, and user management

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.3.4 with Turbopack |
| **Language** | TypeScript 5 |
| **Runtime** | Node.js |
| **Database** | MongoDB via Prisma ORM 6.19 |
| **AI** | Google Gemini (`@google/genai` SDK) |
| **Styling** | Tailwind CSS 4 + `tailwind-merge` + `class-variance-authority` |
| **Icons** | Lucide React |
| **Theming** | `next-themes` (dark/light) |
| **Fonts** | Geist Sans + Geist Mono (Google Fonts) |
| **Validation** | Zod 4 |
| **IDs** | `nanoid` |
| **Sanitization** | `sanitize-html` |
| **Dates** | `date-fns` |
| **Scripts** | `tsx` (TypeScript execution) |
| **Deployment** | Vercel (with cron) |

---

## 3. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APP (Server)                        │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Instrumentation│  │  API Routes  │  │    React Pages (SSR)     │ │
│  │ (startup hook)│  │  /api/*      │  │    / /jobs /companies    │ │
│  └──────┬───────┘  └──────┬───────┘  │    /admin69 /settings    │ │
│         │                 │          └──────────────────────────┘ │
│         ▼                 ▼                                       │
│  ┌──────────────────────────────────────┐                        │
│  │          Core Libraries (src/lib/)    │                        │
│  │                                      │                        │
│  │  scanner/    ← Scan orchestration    │                        │
│  │  adapters/   ← ATS-specific parsers  │                        │
│  │  discovery/  ← HTTP, robots, blocks  │                        │
│  │  relevance/  ← Rule-based scoring    │                        │
│  │  ai/         ← Gemini integration    │                        │
│  │  auth.ts     ← Session management   │                        │
│  │  search.ts   ← Full-text ranking    │                        │
│  │  http.ts     ← Fetch with retries   │                        │
│  └──────────────────┬───────────────────┘                        │
│                     │                                             │
│                     ▼                                             │
│  ┌──────────────────────────────────────┐                        │
│  │     Prisma ORM → MongoDB             │                        │
│  └──────────────────────────────────────┘                        │
│                                                                    │
│  ┌──────────────────────────────────────┐                        │
│  │     Google Gemini API (external)      │                        │
│  └──────────────────────────────────────┘                        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
tt/
├── prisma/
│   └── schema.prisma          # MongoDB schema (10 models)
├── scripts/                   # CLI utilities (tsx)
│   ├── scan.ts                # Manual scan trigger
│   ├── seed.ts                # DB seeding
│   ├── analyze-ai.ts          # Batch AI analysis
│   ├── verify-sources.ts      # Validate career page URLs
│   ├── ai-report.ts           # AI analysis report
│   ├── dump-sqlite.ts         # Export to SQLite JSON
│   ├── import-mongo.ts        # MongoDB data import
│   ├── probe-wrong-ats.ts     # Detect wrong ATS types
│   ├── recover-wrong-ats.ts   # Fix incorrect ATS assignments
│   ├── triage-failures.ts     # Analyze scan failures
│   ├── enable-verified.ts     # Enable verified sources
│   ├── cleanup-legacy.ts      # Remove legacy data
│   └── phase2-verify.ts       # Phase 2 source verification
├── src/
│   ├── instrumentation.ts     # Next.js startup hook
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Geist fonts, ThemeProvider)
│   │   ├── page.tsx           # Home → Dashboard
│   │   ├── globals.css        # Tailwind base styles
│   │   ├── not-found.tsx      # 404 page
│   │   ├── admin69/           # Superadmin console
│   │   ├── companies/         # Company browsing
│   │   ├── jobs/              # Job detail pages
│   │   ├── login/             # Auth login page
│   │   ├── register/          # Auth registration
│   │   ├── settings/          # User preferences
│   │   └── api/               # REST API (9 route groups)
│   │       ├── admin/users/
│   │       ├── ai/            # analyze, recommended, status
│   │       ├── auth/          # login, logout, me, register
│   │       ├── companies/     # CRUD + verify
│   │       ├── cron/scan/     # Vercel cron endpoint
│   │       ├── jobs/          # list + [id] + save + status
│   │       ├── preferences/
│   │       ├── scan/          # trigger + status
│   │       └── stats/
│   ├── components/
│   │   ├── admin-console.tsx  # Superadmin dashboard
│   │   ├── ai-assessment.tsx  # AI fit score card
│   │   ├── app-shell.tsx      # Layout shell + nav
│   │   ├── auth-form.tsx      # Login/register form
│   │   ├── companies-list.tsx # Company directory
│   │   ├── company-detail.tsx # Single company view
│   │   ├── dashboard.tsx      # Main job feed (599 lines)
│   │   ├── job-actions.tsx    # Save/apply action buttons
│   │   ├── job-card.tsx       # Job listing card
│   │   ├── notifications.ts   # Browser notification API
│   │   ├── settings-form.tsx  # Preference editor
│   │   ├── theme-provider.tsx # Dark/light mode
│   │   ├── use-auth.ts       # Auth hook
│   │   └── ui/               # Design system primitives
│   ├── lib/
│   │   ├── adapters/          # ATS parsers (10 adapters)
│   │   ├── ai/                # Gemini intelligence (18 files)
│   │   ├── companies/         # Company verification
│   │   ├── discovery/         # HTTP crawling toolkit
│   │   ├── jobs/              # Job query helpers
│   │   ├── relevance/         # Rule-based scoring
│   │   ├── scanner/           # Scan orchestration
│   │   ├── seed/              # Company seeding data
│   │   ├── api.ts             # Response helpers
│   │   ├── auth.ts            # Auth logic (sessions, passwords)
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── hash.ts            # Job fingerprinting
│   │   ├── http.ts            # fetch wrapper with retries
│   │   ├── location.ts        # Location normalization
│   │   ├── preferences.ts     # Preference loading
│   │   ├── sanitize.ts        # HTML sanitization
│   │   ├── search.ts          # Full-text search ranking
│   │   ├── types.ts           # DTOs (JobDTO, CompanyDTO)
│   │   └── utils.ts           # Shared utilities
│   └── types/
│       └── playwright.d.ts    # Optional Playwright types
├── package.json
├── next.config.ts
├── vercel.json                # Cron schedule
├── tsconfig.json
└── .env.example
```

---

## 5. Database Schema (Prisma / MongoDB)

### Models (10 total)

#### `Company`
The tracked career-page source. Central entity.

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String (cuid) | Primary key |
| `name` | String | Display name |
| `slug` | String (unique) | URL-safe identifier |
| `logo` | String? | Logo URL |
| `careersUrl` | String | Official careers page URL |
| `sourceType` | String | ATS type (`greenhouse`, `lever`, `workday`, etc.) |
| `sourceConfig` | String (JSON) | ATS-specific config |
| `tier` | String | Company tier (`tier-1`, `indian`, `saas`, `ai`, etc.) |
| `enabled` | Boolean | Whether to scan |
| `sourceStatus` | String | `UNVERIFIED` / `VERIFIED` / `UNSUPPORTED` / `FAILED` / `DISABLED` |
| `priority` | String | Scan priority (`A`, `B`, `C`) |
| `category` | String | Company category |
| `indiaHiring` | String | India hiring status |
| Health tracking | Various | `lastCheckedAt`, `checkStatus`, `lastError`, `failureCount`, `blockedCount`, `rateLimitCount`, `consecutiveFailures`, `averageLatencyMs` |
| Diagnostics | Various | `jobsFetched`, `jobsParsed`, `jobsRejected` |

#### `Job`
A discovered job posting, fingerprinted by `hash`.

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String (cuid) | Primary key |
| `companyId` | String (FK) | → Company |
| `title`, `description`, `location`, etc. | String | Normalized job data |
| `rawLocation`, `city`, `country` | String | Parsed location data |
| `skills` | String (JSON array) | Extracted skills |
| `remoteType` | String | `remote` / `hybrid` / `onsite` / `unknown` |
| `applicationUrl` | String | Direct apply link |
| `sourceUrl` | String | Career page URL |
| `hash` | String (unique) | Fingerprint for dedup |
| `searchText` | String | Pre-built full-text search index |
| `postedAt`, `discoveredAt`, `lastSeenAt` | DateTime | Temporal tracking |
| `isNew`, `isActive`, `isRelevant` | Boolean | State flags |
| `relevanceScore` | Int (0–100) | Rule-based score |
| `matchReasons` | String (JSON array) | Why it scored how it did |
| `missingScanCount` | Int | Consecutive scans where job was missing (stale detection) |
| `extractionConfidence` | Int? | Parser confidence |
| **User tracking** | | `userStatus`, `seenAt`, `savedAt`, `appliedAt`, `interviewAt`, `offerAt`, `rejectedAt` |
| **AI fields** (17) | | `aiFitScore`, `aiRecommendation`, `aiSummary`, `aiStrengths`, `aiGaps`, `aiConcerns`, `aiReasoning`, `aiExperienceFit`, `aiSkillFit`, `aiRoleFit`, `aiLocationFit`, `aiRequiredSkillsMatched/Missing`, `aiPreferredSkillsMatched/Missing`, `aiSeniority`, `aiIsEarlyCareer`, `aiRequiresSignificantExperience`, `aiStatus`, `aiAnalyzedAt`, `aiModel`, `aiPromptVersion`, `aiAnalysisHash`, `aiError` |
| `priorityScore` | Float? | Blended AI + rule + freshness priority |

#### `AiQueueItem`
Persistent queue for Gemini analysis work.

| Field | Purpose |
|-------|---------|
| `jobId` (FK) | Job to analyze |
| `status` | `QUEUED` / `PROCESSING` / `COMPLETED` / `FAILED` / `RETRY_WAIT` |
| `priority` | `MANUAL` / `HIGH` / `NORMAL` / `LOW` |
| `priorityRank` | Numeric sort rank (0=manual, 10=high, 50=normal, 80=low) |
| `analysisHash` | Content hash to detect stale queue items |
| `attemptCount` | Retry tracking |
| `nextAttemptAt` | Backoff scheduling |

#### `AiDailyUsage`
Daily budget tracking for Gemini API calls.

#### `User`
User accounts with `candidate` or `superadmin` roles.

#### `Session`
Cookie-based sessions (30-day expiry, `nanoid(48)` tokens).

#### `UserJob`
Per-user job status tracking (saved, applied, interview, etc.).

#### `Preference`
User preferences + system-wide defaults.

| Field | Purpose |
|-------|---------|
| `targetTitles` | JSON array of desired job titles |
| `targetLocations` | JSON array of preferred locations |
| `targetSkills` / `additionalSkills` | Primary and secondary skill sets |
| `experienceLevel` | `0-2`, `2-3`, `new-grad` |
| `remotePreference` | `any`, `remote`, `hybrid`, `onsite` |
| `excludedKeywords` | Title keywords to reject |
| `minimumRelevanceScore` | Minimum score for "relevant" flag |
| `includeSeniorRoles` | Whether to include senior titles |
| `allowInternational` | Whether to include non-India jobs |

#### `ScanRun`
Metadata for each scan execution.

#### `ScanLog`
Per-company log entries for each scan run.

### Key Indexes

- `Job`: Indexed on `hash` (unique), `companyId+isActive`, `isActive+isRelevant+relevanceScore`, `postedAt`, `userStatus`, `discoveredAt`, `searchText`, `aiStatus`, `priorityScore`, `aiAnalysisHash`
- `Company`: Indexed on `slug` (unique), `enabled+tier`, `sourceStatus+priority`
- `AiQueueItem`: Indexed on `jobId+status`, `status+priorityRank+nextAttemptAt`, `analysisHash`

---

## 6. Environment Variables

### Database
| Variable | Purpose | Example |
|----------|---------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |

### Authentication
| Variable | Purpose | Default |
|----------|---------|---------|
| `ADMIN_EMAIL` | Superadmin email | `admin@jobradar.local` |
| `ADMIN_PASSWORD` | Superadmin password | `change-me` |

### Security
| Variable | Purpose |
|----------|---------|
| `SCAN_SECRET` | Cron endpoint auth token |

### Scanner Configuration
| Variable | Default | Purpose |
|----------|---------|---------|
| `SOURCE_REQUEST_DELAY_MS` | `500` | Throttle between requests to same host |
| `HTTP_TIMEOUT_MS` | `20000` | HTTP request timeout |
| `HTTP_MAX_RETRIES` | `2` | Retry count for transient failures |
| `COMPANY_SCAN_TIMEOUT_MS` | `90000` | Max time per company scan |
| `BROWSER_TIMEOUT_MS` | `45000` | Playwright browser timeout |
| `BROWSER_FETCH_ENABLED` | `false` | Enable headless browser (local only) |
| `MAX_PAGES_PER_SOURCE` | `50` | Pagination cap |
| `MAX_DETAIL_PAGES_PER_SOURCE` | `40` | Detail page enrichment cap |
| `SCAN_CONCURRENCY` | `2` | Parallel company scans |
| `SOURCE_VERIFY_CONCURRENCY` | `3` | Parallel source verifications |

### Gemini AI Configuration
| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | — | Google AI API key (server-only) |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Primary model |
| `GEMINI_FALLBACK_MODEL` | — | Fallback on model errors |
| `GEMINI_ENABLED` | `true` | Enable AI analysis |
| `GEMINI_MIN_SCORE` | `70` | Minimum relevance score to auto-analyze |
| `GEMINI_MAX_CONCURRENCY` | `10` | Max parallel AI workers |
| `GEMINI_INITIAL_CONCURRENCY` | `5` | Starting worker count |
| `GEMINI_MAX_RETRIES` | `3` | Retries per job analysis |
| `GEMINI_BATCH_SIZE` | `5` | Jobs per batch API call |
| `GEMINI_TIMEOUT_MS` | `30000` | API call timeout |
| `GEMINI_DAILY_MAX_JOBS` | — | Daily job analysis budget |
| `GEMINI_DAILY_MAX_TOKENS` | — | Daily token budget |
| `CANDIDATE_PROFILE_VERSION` | `1` | Profile cache version |
| `GEMINI_PROMPT_VERSION` | `job-fit-v1` | Prompt version tracking |

### Priority Score Weights
| Variable | Default | Purpose |
|----------|---------|---------|
| `PRIORITY_AI_WEIGHT` | `0.5` | AI fit score weight |
| `PRIORITY_RULE_WEIGHT` | `0.3` | Rule engine weight |
| `PRIORITY_FRESHNESS_WEIGHT` | `0.2` | Freshness weight |

---

## 7. Server Startup & Instrumentation

**File:** `src/instrumentation.ts`

On server start (Node.js runtime only, skipped on Vercel), the `register()` hook:

1. **Seeds the database** — upserts all hardcoded companies from `src/lib/seed/companies.ts` and `companies-additional.ts`
2. **Starts the local scheduler** — polls every 5 minutes, triggers a scan if the configured `scanFrequency` interval has elapsed since the last completed scan
3. **Kicks AI workers** — spawns background Gemini analysis workers to process the AI queue

```
register() → seedDatabase() → startLocalScheduler() → kickAiWorkers()
```

---

## 8. Source Adapter System

**Directory:** `src/lib/adapters/`

### Adapter Registry

A map of `sourceType` → `JobSourceAdapter` instances. Each adapter implements:

```typescript
interface JobSourceAdapter {
  fetchJobs(source: CompanySource): Promise<AdapterResult>;
}
```

### Supported ATS Platforms (10 adapters)

| Adapter | Source Type | Method |
|---------|-----------|--------|
| `GreenhouseAdapter` | `greenhouse` | JSON API (`boards-api.greenhouse.io`) |
| `LeverAdapter` | `lever` | JSON API (`api.lever.co`) |
| `AshbyAdapter` | `ashby` | JSON API (`api.ashbyhq.com`) |
| `SmartRecruitersAdapter` | `smartrecruiters` | JSON API |
| `WorkdayAdapter` | `workday` | JSON API |
| `AmazonAdapter` | `amazon` | Custom scraping |
| `GoogleAdapter` | `google` | Custom parsing |
| `MicrosoftAdapter` | `microsoft` | Custom API |
| `AtlassianAdapter` | `atlassian` | Custom parsing |
| `GenericCareerPageAdapter` | `generic` | HTML scraping + JSON-LD |

### Adapter Pipeline

Each adapter returns an `AdapterResult`:

```typescript
type AdapterResult = {
  jobs: NormalizedJob[];           // Parsed job listings
  extractionMethod: ExtractionMethod;
  diagnostics: AdapterDiagnostics; // fetched/parsed/valid/rejected/duplicates
  blockReason?: BlockReason;       // If the source blocked us
  warning?: string;
  unsupported?: boolean;
  detectedSourceType?: string;     // Auto-detected different ATS
  detectedSourceConfig?: Record<string, unknown>;
};
```

### Normalization Pipeline (`official-pipeline.ts`)

Generic adapter flow:
1. Fetch HTML from career page
2. Extract structured data (JSON-LD, embedded API data)
3. Parse links from HTML
4. Detect ATS type from page content
5. Normalize job fields
6. Filter valid jobs (reject non-engineering, duplicates)
7. Optionally enrich thin descriptions via detail page fetches

### Quality Filters (`quality.ts`)

Jobs are rejected if:
- Title matches non-engineering patterns
- Missing essential fields
- Application URL is invalid
- Company name appears in title (usually generic placeholders)

---

## 9. Scanner Engine

**Directory:** `src/lib/scanner/`

### Core Flow (`service.ts`)

```
startScan(trigger, ?companySlug)
  │
  ├── Create ScanRun record
  ├── Load enabled companies (ordered by priority)
  ├── mapPool(companies, CONCURRENCY=2, async worker)
  │   │
  │   ├── Get adapter for company.sourceType
  │   ├── withDeadline(90s) → adapter.fetchJobs(source)
  │   ├── Handle ATS auto-detection (update sourceType if different)
  │   ├── Handle blocks (update blocked counts)
  │   │
  │   ├── For each job:
  │   │   ├── normalizeLocation()
  │   │   ├── jobFingerprint() → hash
  │   │   ├── scoreJob() → rule-based relevance
  │   │   ├── mergeDescription() + sanitizeJobHtml()
  │   │   ├── buildSearchText()
  │   │   └── Upsert to DB (create or update)
  │   │
  │   ├── Stale detection: jobs missing for 3+ consecutive scans → isActive=false
  │   ├── Update company health metrics
  │   └── Create ScanLog entry
  │
  ├── Update ScanRun with totals
  └── scheduleAiAfterScan() → kickAiWorkers()
```

### Key Behaviors

- **Concurrency pool:** Up to `SCAN_CONCURRENCY` (default 2) companies scanned in parallel
- **Deadline:** Each company scan has a 90s timeout
- **Stale detection:** Jobs not seen in 3 consecutive scans are marked inactive
- **Engineering filter:** `limitJobs()` filters to engineering titles, caps at 180 per company
- **200ms cooldown** between companies

### Scheduler (`scheduler.ts`)

- Runs as a `setInterval` every 5 minutes
- Checks if `scanFrequency` interval has elapsed since last completed scan
- Disabled on Vercel (`VERCEL` env) or via `DISABLE_LOCAL_SCHEDULER=1`

---

## 10. Discovery Layer

**Directory:** `src/lib/discovery/`

### HTTP Client (`http.ts`)

`fetchWithRetry()` — Production-grade HTTP client:

- **Retry logic:** Exponential backoff with `Retry-After` header support
- **Transient status codes:** 408, 425, 429, 500, 502, 503, 504
- **Timeout:** Configurable per request (default 20s)
- **Robots.txt:** `isAllowedByRobots()` check (optional, enabled for HTML fetches)
- **Host throttling:** `throttleHost()` enforces per-domain request delays
- **Block detection:** `classifyHttpBlock()` detects CAPTCHAs, antibot, rate limits, access denied
- **User-Agent:** Sets a custom, non-deceptive `JOB_RADAR_HEADERS`

### Block Detection (`blocks.ts`)

Classifies responses as:
- `RATE_LIMITED` — 429 or rate limit headers
- `ACCESS_DENIED` — 401/403
- `BLOCKED_BY_CAPTCHA` — Cloudflare challenge pages
- `BLOCKED_BY_ANTIBOT` — Anti-bot detection pages

### Robots.txt (`robots.ts`)

- Parses `robots.txt` and caches per-host
- Respects `Disallow` / `Allow` directives
- Applied to HTML/sitemap fetches (not official JSON APIs)

### ATS Detection (`ats-detect.ts`)

Auto-detects ATS platform from HTML content:
- Greenhouse, Lever, Ashby board URLs
- Workday URLs
- SmartRecruiters patterns
- Returns detected source type + config

### Job Extraction (`embedded.ts`)

Extracts jobs from:
- **JSON-LD** (`application/ld+json` `JobPosting` schema)
- **Embedded JavaScript** (inline JSON data, `__NEXT_DATA__`, etc.)
- Links matching career page patterns

### Date Parsing (`dates.ts`)

Normalizes diverse date formats found on career pages:
- ISO 8601, RFC 2822
- Relative dates ("2 days ago", "posted yesterday")
- Various locale formats

### URL Utilities (`urls.ts`)

- Resolves relative URLs against base
- Normalizes career page URLs
- Validates application URLs

---

## 11. Relevance Engine (Rule-Based Scoring)

**Directory:** `src/lib/relevance/`

### Scoring Algorithm (`engine.ts`)

`scoreJob()` produces a 0–100 score from five components:

| Component | Max Points | Logic |
|-----------|-----------|-------|
| **Title** | 35 | Regex patterns: excellent (35), target match (32), good (22), low (8), engineering (12). Rejects non-engineering titles (0). Penalizes senior (-25). |
| **Experience** | 22 | Detects career level from text. Early-career/new-grad = 22, mid = 8–18, senior = 1–4, intern = 6–10. |
| **Skills** | 25 | Matches primary skills (5 pts each) + additional (2 pts each). Uses `RELATED_SKILLS` aliases. |
| **Location** | 14 | India preferred (+10), remote India (+10), international with setting (+5–6), non-India (-8). Remote preference bonus. |
| **Freshness** | 10 | Today=10, 3 days=8, 7 days=6, 14 days=3, 15+=1. |

### Default Profile (`defaults.ts`)

- **Target Titles:** Software Engineer, SDE, Full Stack Engineer, Frontend/Backend Engineer, etc.
- **Strong Skills:** JavaScript, TypeScript, Python, React, Next.js, Node.js, SQL, MongoDB, Docker, AWS
- **Additional Skills:** C, C++, Java, Prisma, CI/CD, Kubernetes, Redis, GraphQL
- **Preferred Locations:** Bangalore, Hyderabad, Pune, Mumbai, Delhi NCR, Chennai, Remote India
- **Excluded Keywords:** senior, staff, principal, lead, manager, director, architect, head of, VP

### International Filter

`passesInternationalFilter()` — when `allowInternational` is off, only shows India-located jobs.

---

## 12. AI Intelligence Layer (Gemini)

**Directory:** `src/lib/ai/` (18 files)

### Architecture

```
enqueueEligibleJobs() → AI Queue (MongoDB) → Workers → Gemini API → persistAnalysis()
     │                       │                  │
     │                       │                  ├── Circuit breaker
     │                       │                  ├── Rate limit handling
     │                       │                  └── Retry with backoff
     │                       │
     │                       └── Priority ordering (MANUAL > HIGH > NORMAL > LOW)
     │
     └── Eligibility: isActive && isRelevant && relevanceScore >= GEMINI_MIN_SCORE
```

### Candidate Profile (`profile.ts`)

Hardcoded early-career software engineer profile sent to Gemini:
- **Career stage:** Fresh graduate / early career (0–2 years)
- **Target roles:** 16 role titles (SDE, Software Engineer, Full Stack, Frontend, Backend, AI/ML, etc.)
- **Primary skills:** 16 (JS, TS, Python, React, Next.js, Node.js, SQL, MongoDB, PostgreSQL, Docker, AWS, etc.)
- **Additional skills:** 14 (C, C++, Java, Prisma, OAuth, CI/CD, LLM, Generative AI, etc.)
- **Preferred locations:** 9 Indian cities + Remote India

### System Prompt (`prompt.ts`)

A detailed 62-line system instruction that:
- Acts as "extremely precise technical recruiter"
- Evaluates only supplied data (no browsing/inventing)
- Distinguishes required vs. preferred qualifications
- Has specific experience fit guidance (0–2 years ideal, 4+ poor)
- Weighted scoring: Role 30, Experience 30, Skill 25, Location 10, Career-stage 5
- Recommendation levels: APPLY_NOW (90+), STRONG_MATCH (80–89), CONSIDER (65–79), LOW_PRIORITY (45–64), SKIP (<45)

### Response Schema (`schema.ts`)

Gemini returns structured JSON validated by Zod:

```typescript
type JobAnalysis = {
  fitScore: number;          // 0–100
  recommendation: "APPLY_NOW" | "STRONG_MATCH" | "CONSIDER" | "LOW_PRIORITY" | "SKIP";
  summary: string;           // ≤800 chars
  strengths: string[];       // What matches
  gaps: string[];            // What's missing
  concerns: string[];        // Red flags
  reasoning: string;         // ≤2000 chars detailed explanation
  experienceFit: FitLevel;   // excellent/good/moderate/poor/unknown
  skillFit: FitLevel;
  roleFit: FitLevel;
  locationFit: FitLevel;
  isEarlyCareer: boolean;
  requiresSignificantExperience: boolean;
  requiredSkillsMatched: string[];
  requiredSkillsMissing: string[];
  preferredSkillsMatched: string[];
  preferredSkillsMissing: string[];
  seniority: "entry" | "junior" | "mid" | "senior" | "staff" | "lead" | "principal" | "unknown";
};
```

### Gemini Client (`client.ts`)

- Uses `@google/genai` SDK (`GoogleGenAI`)
- JSON mode with structured schema (`responseMimeType: "application/json"`)
- Temperature: 0.2 (deterministic)
- Timeout via `AbortController` + `Promise.race`
- **Fallback model:** Tries `GEMINI_FALLBACK_MODEL` on 404/model-not-found errors

### Queue System (`queue.ts`)

**Persistent queue** backed by `AiQueueItem` model:

- **Enqueue:** `enqueueJob()` creates/updates queue items, deduplicates by hash
- **Workers:** `kickAiWorkers()` spawns concurrent workers (adaptive concurrency)
- **Claim:** Atomic `updateMany` to claim items (prevents double-processing)
- **Batching:** Groups up to `GEMINI_BATCH_SIZE` jobs per API call
- **Adaptive concurrency:**
  - On success: `currentLimit += 1` (up to `GEMINI_MAX_CONCURRENCY`)
  - On 429: `currentLimit *= 0.7`
  - On transient failure: `currentLimit -= 1`
- **Quota pause:** Stops all workers on quota exhaustion, sets 1-hour retry

### Circuit Breaker (`circuit.ts`)

- **Failure threshold:** 5 consecutive failures
- **Cooldown:** 30 seconds
- States: CLOSED (normal) → OPEN (blocked) → HALF_OPEN (testing)

### Error Classification (`errors.ts`)

Classifies Gemini errors into:
- `rate_limit` — 429, transient, uses backoff
- `quota_exhausted` — 429 with "quota" in message, stops workers
- `timeout` — transient
- `overloaded` — 503, transient
- `invalid_response` — bad JSON, not transient
- `missing_key` — no API key
- `server_error` — 500, transient

### Disagreement Detection (`disagreement.ts`)

Flags when AI and rule scores significantly disagree:
- `REVIEW_RULE_ENGINE` — AI high, rule low (AI thinks it's good, rules disagree)
- `POSSIBLE_FALSE_NEGATIVE` — AI low, rule high (rules think it's good, AI disagrees)

### Priority Score (`priority.ts`)

Blended ranking: `priorityScore = (AI × 0.5) + (Rule × 0.3) + (Freshness × 0.2)`

### Metrics (`metrics.ts`)

In-memory telemetry:
- Request/success/failure counts
- Cache hits
- Rate limits and retries
- Average latency
- Daily job/token budgets
- Queue length

### Analysis Hash (`hash.ts`)

Content-addressable caching — if job content hasn't changed, skips re-analysis:
```
hash = SHA-256(jobId + title + description + skills + location + employmentType)
```

---

## 13. Search System

**File:** `src/lib/search.ts`

### Query Parsing

- Supports quoted phrases (`"software engineer"`)
- Strips stop words (a, an, the, in, at, for, etc.)
- **Token aliases:** `ts` → `typescript`, `js` → `javascript`, `node` → `node.js`/`nodejs`, `k8s` → `kubernetes`, `bangalore` ↔ `bengaluru`, `sde` → `software engineer`

### Ranking Algorithm

`rankSearchJob()` scores search results:

| Match Location | Points |
|---------------|--------|
| Title match | 48–56 (multi-word = 56) |
| Skill match | 30 |
| Company name | 24 |
| City/location | 20 |
| Full-text body | 8 |
| All tokens matched bonus | 36 |
| Partial match bonus | 6 per token |
| Target title match | +10 |
| Target skill match | +8 |
| Target location match | +6 |
| Remote preference match | +4 |

Final score = search score + (relevanceScore × 0.35)

### Pre-built Search Index

`buildSearchText()` concatenates title, company, city, country, location, skills, and description into a single lowercase field for fast substring matching.

---

## 14. Authentication & Authorization

**File:** `src/lib/auth.ts`

### Password Security

- **Hashing:** `scrypt` (Node.js crypto) with random 16-byte salt
- **Storage:** `salt:hash` format
- **Verification:** Constant-time comparison (`timingSafeEqual`)

### Session Management

- **Token:** `nanoid(48)` — cryptographically random
- **Cookie:** `jr_session`, httpOnly, sameSite=lax, 30-day expiry, secure in production
- **Storage:** `Session` model in MongoDB
- **Expiry check:** Server-side on every request

### Roles

- **`candidate`** — regular user, can view jobs, save, apply, manage preferences
- **`superadmin`** — full access, admin console at `/admin69`, manages users/scans/sources

### Superadmin Bootstrap

`ensureSuperadmin()` — automatically creates/updates the superadmin account on startup using `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars.

### Default Preferences

On first user login, `copyDefaultPreferences()` clones the system-wide default preferences to their account.

---

## 15. API Routes

### Authentication

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Email/password login, returns session cookie |
| `/api/auth/logout` | POST | Clears session |
| `/api/auth/register` | POST | Create candidate account |
| `/api/auth/me` | GET | Current user info |

### Jobs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/jobs` | GET | List jobs with filters (pagination, search, minScore, experience, location, role, tier, freshness, sort, status) |
| `/api/jobs/[id]` | GET | Single job detail |
| `/api/jobs/[id]/save` | POST | Toggle save status |
| `/api/jobs/[id]/status` | POST | Update application status (saved/applied/interview/offer/rejected) |

### Companies

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/companies` | GET | List companies with coverage stats |
| `/api/companies/[id]` | GET | Company detail with jobs |
| `/api/companies/[id]/verify` | POST | Verify single source |
| `/api/companies/verify` | POST | Batch verify all sources |

### Scanner

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/scan` | POST | Trigger manual scan |
| `/api/scan/status` | GET | Scan progress + company status |
| `/api/cron/scan` | GET | Vercel cron trigger (requires `SCAN_SECRET`) |

### AI

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/analyze` | POST | Batch analyze jobs (manual trigger) |
| `/api/ai/analyze/[jobId]` | POST | Analyze single job |
| `/api/ai/recommended` | GET | Top AI-recommended jobs |
| `/api/ai/status` | GET | Gemini worker status + metrics |

### Other

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stats` | GET | Dashboard stats (relevant, new today, excellent, saved, applied) |
| `/api/preferences` | GET/POST | User preference management |
| `/api/admin/users` | GET | List all users (superadmin only) |

---

## 16. Frontend (React / Next.js Pages)

### Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Dashboard` | Main job feed with filters, search, scan trigger, recommended section |
| `/admin69` | `AdminConsole` | Superadmin control plane (requires auth) |
| `/companies` | `CompaniesList` | Browse tracked companies |
| `/companies/[slug]` | `CompanyDetail` | Company detail with job listings |
| `/jobs/[id]` | Job detail page | Full job view with AI assessment |
| `/login` | `AuthForm` | Login page |
| `/register` | `AuthForm` | Registration page |
| `/settings` | `SettingsForm` | Preference editor |

### Dashboard Features (`dashboard.tsx`)

- **Stats bar:** Relevant jobs, New today, Excellent matches, Saved, Applied
- **Search:** Debounced full-text search (300ms)
- **Filters:** Score threshold (90+/80+/70+/All), Experience level, Location, Role type, Company tier, Freshness, Sort order, Application status
- **Recommended section:** Expandable panel that triggers Gemini analysis
- **Scan status panel:** Real-time scan progress with per-company status
- **Loading screen:** Animated progress bar with step-by-step logs and rotating tips
- **Job cards:** Each card shows title, company, location, score, match reasons, AI assessment, save/apply buttons
- **Pagination:** 20 jobs per page
- **Browser notifications:** Alerts when new jobs are found after scan

### Admin Console (`admin-console.tsx`)

- Login-gated to superadmin role
- Batch source verification trigger
- Gemini telemetry dashboard (workers, circuit state, latency, cache hits, rate limits)
- Source health table (fetched/parsed/rejected, blocks, errors per company)
- Unsupported/failed source lists
- User management table

### Design System (`components/ui/`)

Custom component library using `class-variance-authority`:
- Button (variants: default, outline, ghost, destructive; sizes: sm, md, lg)
- Input
- Other primitives

### Theme

- Dark/light mode via `next-themes`
- Geist Sans + Geist Mono fonts
- Tailwind CSS 4 utility classes

---

## 17. Deployment (Vercel)

### Configuration

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/scan", "schedule": "0 0 * * *" }
  ]
}
```

- **Daily cron** at midnight UTC triggers `/api/cron/scan`
- Protected by `SCAN_SECRET` header validation
- On Vercel, `instrumentation.ts` skips local scheduler + seed (avoids cold-start overhead)
- Prisma is `serverExternalPackages` in `next.config.ts`

### Build

```bash
prisma generate && next build
```

### Environment

- `VERCEL` env flag controls Vercel-specific behavior
- `MONGODB_URI` connects to MongoDB Atlas
- `GEMINI_API_KEY` enables AI layer
- `SCAN_SECRET` protects cron endpoint

---

## 18. CLI Scripts

**Directory:** `scripts/` (all run via `tsx`)

| Script | Command | Purpose |
|--------|---------|---------|
| `scan.ts` | `npm run scan` | Manual full scan |
| `seed.ts` | `npm run db:seed` | Seed companies into DB |
| `analyze-ai.ts` | `npm run analyze:ai` | Batch Gemini analysis |
| `verify-sources.ts` | `npm run verify:sources` | Validate all career page URLs |
| `ai-report.ts` | `tsx scripts/ai-report.ts` | Generate AI analysis report |
| `dump-sqlite.ts` | `tsx scripts/dump-sqlite.ts` | Export DB to JSON |
| `import-mongo.ts` | `tsx scripts/import-mongo.ts` | Import data to MongoDB |
| `probe-wrong-ats.ts` | `tsx scripts/probe-wrong-ats.ts` | Detect misidentified ATS types |
| `recover-wrong-ats.ts` | `tsx scripts/recover-wrong-ats.ts` | Fix wrong ATS assignments |
| `triage-failures.ts` | `tsx scripts/triage-failures.ts` | Analyze scan failure patterns |
| `enable-verified.ts` | `tsx scripts/enable-verified.ts` | Enable verified sources |
| `cleanup-legacy.ts` | `tsx scripts/cleanup-legacy.ts` | Remove legacy data |
| `phase2-verify.ts` | `tsx scripts/phase2-verify.ts` | Phase 2 source verification |

---

## 19. Testing

```bash
npm test
```

Runs via `tsx --test` with Node.js built-in test runner.

### Test Files (13)

| File | Coverage |
|------|----------|
| `discovery/blocks.test.ts` | HTTP block detection |
| `discovery/robots.test.ts` | Robots.txt parsing |
| `discovery/throttle.test.ts` | Host-level throttling |
| `discovery/deadline.test.ts` | Timeout enforcement |
| `discovery/dates.test.ts` | Date parsing |
| `discovery/urls.test.ts` | URL normalization |
| `discovery/embedded.test.ts` | JSON-LD / embedded extraction |
| `discovery/quality.test.ts` | Job quality filters |
| `discovery/browser.test.ts` | Browser fetch logic |
| `http.test.ts` | HTTP client retry logic |
| `adapters/official-pipeline.test.ts` | Adapter pipeline |
| `companies/verify.test.ts` | Source verification |
| `ai/ai.test.ts` | AI analysis (14KB, mocked Gemini) |

### Type Checking

```bash
npm run typecheck   # tsc --noEmit
```

---

## 20. Data Flow Diagrams

### Scan → Score → AI Pipeline

```
Company career pages
        │
        ▼
   ┌─────────┐    ┌──────────┐    ┌──────────────┐
   │  Adapter │───▶│ Normalize│───▶│ Fingerprint  │
   │ (fetch)  │    │ (parse)  │    │ (dedup hash) │
   └─────────┘    └──────────┘    └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  Rule Scoring │ ← Preferences
                                  │  (0–100)      │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  Upsert to   │
                                  │  MongoDB     │
                                  └──────┬───────┘
                                         │
                                   (score ≥ 70)
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  AI Queue    │
                                  │  (persistent)│
                                  └──────┬───────┘
                                         │
                                    (workers)
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  Gemini API  │
                                  │  (structured)│
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ AI Fit Score │
                                  │ + Priority   │
                                  │ (persisted)  │
                                  └──────────────┘
```

### User Journey

```
Visit /  ──▶  Dashboard loads stats + jobs
              │
              ├── Search / filter jobs
              ├── Expand "Recommended" → triggers AI analysis
              ├── Click "Scan now" → poll /api/scan/status
              ├── Save job → /api/jobs/[id]/save
              ├── Mark applied → /api/jobs/[id]/status
              └── Settings → /settings (preferences)
```

### Admin Journey

```
Visit /admin69  ──▶  Login (superadmin)
                     │
                     ├── View source health table
                     ├── "Verify sources" → /api/companies/verify
                     ├── "Scan now" → /api/scan
                     ├── View Gemini telemetry
                     ├── View user accounts
                     └── Navigate to /companies, /settings, /
```
