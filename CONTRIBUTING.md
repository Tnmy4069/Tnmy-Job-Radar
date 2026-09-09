# Contributing to Job Radar

First off, thank you for considering contributing to Job Radar! It's people like you that make open-source tools better for everyone.

## Getting Started

To get started with local development, please refer to the **Setup** section in the [README.md](README.md).

### Tech Stack
- **Framework:** Next.js (App Router)
- **Database:** MongoDB via Prisma
- **AI:** Google Gemini
- **Styling:** Tailwind CSS

## Architecture Overview

Job Radar works by scraping official company career pages and ATS APIs rather than relying on job aggregators. 

The core flow is:
1. `JobSourceAdapters` fetch data from official APIs or career pages.
2. The data is normalized, deduped via a fingerprinting system, and scored for relevance.
3. If relevant, jobs are enqueued for AI-based semantic evaluation using Google Gemini.

For a deep dive into the database schema and system internals, read the [System Documentation](system.md).

## How to Contribute

### 1. Adding a New Company
To add a new company that uses one of the supported ATS systems (like Greenhouse, Lever, Workday):
1. Add the company to `src/lib/seed/companies-additional.ts`. 
2. It will start as `UNVERIFIED`. Use `npm run verify:sources` to probe the official endpoint.
3. Once it returns real jobs, it can be marked as `VERIFIED` and enabled.

### 2. Adding a New ATS Adapter
If a company uses an ATS we don't currently support:
1. Create a new `JobSourceAdapter` implementation under `src/lib/adapters/`.
2. Normalize the returned jobs using `completeJob()`.
3. Register your new adapter in `src/lib/adapters/registry.ts`.
4. Create a test to ensure it correctly fetches and normalizes jobs.

*Note: Please prefer official JSON APIs over HTML scraping whenever possible, and never bypass CAPTCHAs or auth walls.*

### 3. Fixing Bugs or Adding Features
1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, please add tests.
3. Ensure your code passes all linting (`npm run lint`).
4. Update documentation if necessary.

## Submitting a Pull Request

1. Create a Pull Request against the `main` branch.
2. Fill out the provided PR template.
3. Link any relevant issues to the PR.
4. Ensure your PR summary clearly explains *what* changes were made and *why*.

By contributing, you agree that your contributions will be licensed under its MIT License.
