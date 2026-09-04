# Job Radar

Discover software engineering jobs from **official company career pages and ATS APIs**, rank them for an early-career (0–2 years) profile, and track apply status.

The app never invents jobs. Unavailable seeources are marked `unsupported` or `failed`.

## Architecture

```text
UI (Next.js App Router)
    ↓
API routes  /api/jobs  /api/scan  /api/companies  /api/preferences
    ↓
Scanner (async, concurrent, 3-miss stale grace)
    ↓
JobSource adapters
 ├── GreenhouseAdapter
 ├── LeverAdapter
 ├── AshbyAdapter
 ├── SmartRecruitersAdapter
 ├── WorkdayAdapter
 ├── AmazonAdapter
 ├── GoogleAdapter
 ├── MicrosoftAdapter
 ├── AtlassianAdapter
 └── GenericCareerPageAdapter
    ↓
Normalize location → fingerprint → relevance → MongoDB (Prisma)
```

Schedulers (pick one):

- Local interval (`src/instrumentation.ts`) when `scanFrequency` is not `manual`
- `POST /api/scan` (manual, returns immediately + client polls)
- `GET /api/cron/scan` (Vercel Cron / external cron — requires `SCAN_SECRET` in production)
- GitHub Actions (`.github/workflows/scan.yml`)

## Setup

```bash
npm install
cp .env.example .env
npx prisma db push
npx tsx scripts/enable-verified.ts   # seed + enable verified sources
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Scan now**.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Prisma MongoDB connection string |
| `SCAN_SECRET` | Required in production for `/api/cron/scan` |
| `NEXT_PUBLIC_APP_URL` | Public URL for cron docs |
| `DISABLE_LOCAL_SCHEDULER` | Set `1` to disable in-process scheduler |

## Working sources (verified with real fetches)

| Company | Adapter | Status |
| --- | --- | --- |
| Amazon | amazon.jobs JSON | WORKING |
| Adobe | Workday CXS | WORKING |
| Google | Official careers HTML payload | WORKING |
| Stripe | Greenhouse | WORKING |
| Datadog | Greenhouse | WORKING |
| Cloudflare | Greenhouse | WORKING |
| Figma | Greenhouse | WORKING |
| NVIDIA | Workday CXS | WORKING |
| GitLab | Greenhouse | WORKING |
| Twilio | Greenhouse | WORKING |
| Dropbox | Greenhouse | WORKING |
| Okta | Greenhouse | WORKING |
| Elastic | Greenhouse | WORKING |
| Notion | Ashby | WORKING |
| OpenAI | Ashby | WORKING |
| Databricks | Greenhouse | WORKING |
| Glean | Greenhouse (`gleanwork`) | WORKING |
| Microsoft | microsoft adapter | UNSUPPORTED (official APIs 403 / unavailable) |
| Atlassian | atlassian adapter | UNSUPPORTED (careers APIs 404) |

All other seeded companies remain **disabled** until an official public endpoint is confirmed (`NOT_CONFIGURED` / generic).

## Running scans

```bash
# CLI (blocking)
npm run scan

# Full Phase 2 verification (two scans + report)
npx tsx scripts/phase2-verify.ts

# Enable verified companies after seed
npx tsx scripts/enable-verified.ts
```

Manual UI scan starts asynchronously and polls `/api/scan/status`. Overlapping scans return **409**.

Single company:

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d "{\"company\":\"amazon\"}"
```

## Cron

Default preference: every **6 hours**.

```bash
curl -H "Authorization: Bearer $SCAN_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/scan"
```

## Relevance

0–100 score:

| Signal | Points |
| --- | --- |
| Title (excellent / good / low / reject) | 35 / 22 / 8 / 0 |
| Experience | 20 |
| Skills | 25 |
| Location | 10 |
| Freshness (`postedAt` only) | 10 |

When **Allow international** is off, the jobs feed shows **India only**.

## Dedup + stale jobs

- Fingerprint: `externalId + company` when available, else `company + title + city + application URL`
- `isNew` = first discovery only (not based on `postedAt`)
- Missing from a successful fetch increments `missingScanCount`; inactive after **3** misses
- Failed / empty fetches do not deactivate jobs
- `userStatus` and status timestamps are never overwritten by the scanner

## Adding a company

1. Add / update [`src/lib/seed/companies.ts`](src/lib/seed/companies.ts)
2. Point `sourceType` at a working adapter and set `sourceConfig`
3. **Probe the official endpoint** — only enable after real jobs return
4. `npx tsx scripts/enable-verified.ts` or enable from the Companies UI

## Adding an adapter

1. Implement `JobSourceAdapter` under `src/lib/adapters/`
2. Normalize with `completeJob()`
3. Register in `src/lib/adapters/registry.ts`

Prefer official JSON APIs. Do not bypass CAPTCHA / anti-bot / auth.

## Known limitations

- Microsoft and Atlassian public career APIs are currently blocked or gone; they stay unsupported
- Workday list endpoints often omit full descriptions
- Google parsing depends on careers page payload shape
- Many Indian product companies have no public ATS JSON yet
- Ashby boards (e.g. OpenAI) can be large; the scanner caps engineering titles per company
- No LinkedIn / Indeed / Glassdoor / aggregators

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Empty feed | Scan now; confirm Settings allow India / international |
| Company unsupported | Official endpoint unavailable — leave disabled |
| Prisma EPERM on Windows | Stop `next dev`, run `npx prisma generate`, restart |
| Scan already in progress | Wait for poll to finish or check `/api/scan/status` |
| Duplicates after location change | Run scan twice; legacy rows without `searchText` can be cleaned with `npx tsx scripts/cleanup-legacy.ts` |
