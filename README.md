# Job Radar

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

Discover software engineering jobs from **official company career pages and ATS APIs**, rank them for an early-career (0–2 years) profile, and track apply status.

The app never invents jobs. Unavailable sources are marked `unsupported` or `failed`.

**Job Radar uses official company/ATS career sources and does not rely on third-party job aggregators.**

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
| `SCAN_CONCURRENCY` | Parallel company scans (1–3, default 2) |
| `SOURCE_VERIFY_CONCURRENCY` | Parallel source verification (1–3, default 3) |

## Company coverage

Job Radar uses official company/ATS career sources and does not rely on third-party job aggregators.

| | Count |
| --- | --- |
| Tracked | 180 |
| Verified (enabled) | 108 |
| Unverified | 0 |
| Unsupported | 19 |
| Failed | 53 |

Supported ATS adapters:

- Greenhouse
- Lever
- Workday
- Ashby
- SmartRecruiters
- Custom / official JSON (Amazon, Google)
- Generic official career pages

Seed ATS mix (all tracked companies): Greenhouse 64 · generic 94 · Ashby 11 · Workday 5 · Lever 2 · Amazon / Google / Microsoft / Atlassian 1 each.

Only `sourceStatus = VERIFIED` companies are enabled. Microsoft and Atlassian stay **UNSUPPORTED** and disabled.

Re-verify sources:

```bash
npm run verify:sources
```

## Previously confirmed sources

These adapters were not overwritten during expansion:

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

Additional companies are enabled only after a live official-source fetch returns real jobs with official application URLs. See `/companies` for verified / unsupported / failed reports.

## Running scans

```bash
# CLI (blocking)
npm run scan

# Full Phase 2 verification (two scans + report)
npx tsx scripts/phase2-verify.ts

# Enable previously confirmed companies after seed
npx tsx scripts/enable-verified.ts

# Verify unverified official sources (does not guess ATS)
npm run verify:sources
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

1. Add / update [`src/lib/seed/companies.ts`](src/lib/seed/companies.ts) or [`src/lib/seed/companies-additional.ts`](src/lib/seed/companies-additional.ts)
2. New companies start `enabled=false` and `sourceStatus=UNVERIFIED`
3. **Probe the official endpoint** (`npm run verify:sources` or Verify source in the UI)
4. Enable only after `sourceStatus=VERIFIED`

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

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started, add new companies, or create new ATS adapters.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
