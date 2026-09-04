import { prisma } from "../src/lib/db";
import { geminiApiKey, geminiEnabled, geminiMinScore, geminiModel } from "../src/lib/ai/config";
import { analyzeJob, type AnalyzableJob } from "../src/lib/ai/analyze";
import { analyzeTopRelevantJobs, getAiWorkerState } from "../src/lib/ai/queue";
import { getAiMetrics } from "../src/lib/ai/metrics";
import { resetCircuitForTests } from "../src/lib/ai/circuit";

function loadEnvFile() {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key].trim() === "") process.env[key] = value;
  }
  if (!process.env.GEMINI_API_KEY && process.env.GEMINI_API_Key) {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_Key;
  }
}

loadEnvFile();

type Pattern = {
  label: string;
  company?: string;
  titles: string[];
  prefer?: (title: string) => boolean;
};

const PATTERNS: Pattern[] = [
  {
    label: "Adobe Computer Scientist / Full Stack",
    company: "Adobe",
    titles: ["Computer Scientist I", "Full Stack", "Computer Scientist"],
    prefer: (title) => /computer scientist i\b|full stack/i.test(title) && !/\bsr\.|\bsenior\b|\bstaff\b/i.test(title),
  },
  {
    label: "GitLab Intermediate Backend",
    company: "GitLab",
    titles: ["Intermediate Backend", "Backend Engineer", "Backend"],
  },
  {
    label: "Amazon SDE",
    company: "Amazon",
    titles: ["SDE", "Software Development Engineer"],
    prefer: (title) => /\bsde\b|software development engineer/i.test(title) && !/\bsr\.|\bsenior\b|\bstaff\b/i.test(title),
  },
  {
    label: "Cloudflare Software Engineer",
    company: "Cloudflare",
    titles: ["Software Engineer"],
    prefer: (title) => /software engineer/i.test(title) && !/\bsr\.|\bsenior\b|\bstaff\b/i.test(title),
  },
  {
    label: "Staff/Senior role",
    titles: ["Staff Software", "Senior Software Engineer", "Staff Engineer"],
  },
  {
    label: "Technical Support",
    titles: ["Technical Support", "Support Engineer"],
  },
  {
    label: "Applications Engineer",
    titles: ["Applications Engineer", "Application Engineer"],
  },
];

async function findRepresentative(pattern: Pattern) {
  const rows = await prisma.job.findMany({
    where: {
      isActive: true,
      OR: pattern.titles.map((title) => ({ title: { contains: title } })),
      ...(pattern.company ? { company: { name: { contains: pattern.company } } } : {}),
    },
    include: { company: { select: { name: true, priority: true } } },
    orderBy: { relevanceScore: "desc" },
    take: 20,
  });
  if (pattern.prefer) {
    const preferred = rows.find((row) => pattern.prefer!(row.title));
    if (preferred) return preferred;
  }
  return rows[0] ?? null;
}

async function main() {
  resetCircuitForTests();
  if (!geminiApiKey()) {
    console.error("GEMINI_API_KEY / GEMINI_API_Key is missing");
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      enabled: geminiEnabled(),
      model: geminiModel(),
      minScore: geminiMinScore(),
      keyPresent: true,
    })
  );

  const started = Date.now();
  const samples = [];
  for (const pattern of PATTERNS) {
    process.stdout.write(`finding ${pattern.label}...\n`);
    const job = await findRepresentative(pattern);
    if (!job) {
      samples.push({ label: pattern.label, missing: true });
      continue;
    }
    process.stdout.write(`analyzing ${job.company.name} — ${job.title}\n`);
    try {
      const outcome = await analyzeJob(job as AnalyzableJob, {
        force: true,
        overrideThreshold: true,
      });
      samples.push({
        label: pattern.label,
        title: job.title,
        company: job.company.name,
        ruleScore: job.relevanceScore,
        aiScore: outcome.analysis?.fitScore ?? job.aiFitScore,
        recommendation: outcome.analysis?.recommendation,
        experienceFit: outcome.analysis?.experienceFit,
        roleFit: outcome.analysis?.roleFit,
        skillFit: outcome.analysis?.skillFit,
        gaps: outcome.analysis?.gaps?.slice(0, 3) ?? [],
        summary: outcome.analysis?.summary,
        error: outcome.error,
        cacheHit: outcome.cacheHit,
      });
      if (outcome.error) process.stdout.write(`  error: ${outcome.error}\n`);
      else process.stdout.write(`  ai=${outcome.analysis?.fitScore} ${outcome.analysis?.recommendation}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`  throw: ${message}\n`);
      samples.push({
        label: pattern.label,
        title: job.title,
        company: job.company.name,
        ruleScore: job.relevanceScore,
        error: message,
      });
    }
  }

  const eligible = await prisma.job.count({
    where: { isActive: true, isRelevant: true, relevanceScore: { gte: geminiMinScore() } },
  });
  const relevant = await prisma.job.count({
    where: { isActive: true, isRelevant: true },
  });
  process.stdout.write(`enqueue eligible=${eligible} relevant=${relevant}\n`);
  const queued = await analyzeTopRelevantJobs();
  const drainStarted = Date.now();
  while (Date.now() - drainStarted < 8 * 60 * 1000) {
    const pending = await prisma.aiQueueItem.count({
      where: { status: { in: ["QUEUED", "PROCESSING", "RETRY_WAIT"] } },
    });
    process.stdout.write(`queue pending=${pending}\n`);
    if (pending === 0) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  const workers = getAiWorkerState();
  const metrics = getAiMetrics();
  const analyzed = await prisma.job.count({ where: { aiStatus: "ANALYZED" } });
  const failed = await prisma.job.count({ where: { aiStatus: "FAILED" } });
  const [applyNow, strong, consider, low, skip] = await Promise.all([
    prisma.job.count({ where: { aiRecommendation: "APPLY_NOW" } }),
    prisma.job.count({ where: { aiRecommendation: "STRONG_MATCH" } }),
    prisma.job.count({ where: { aiRecommendation: "CONSIDER" } }),
    prisma.job.count({ where: { aiRecommendation: "LOW_PRIORITY" } }),
    prisma.job.count({ where: { aiRecommendation: "SKIP" } }),
  ]);

  console.log(
    JSON.stringify(
      {
        durationMs: Date.now() - started,
        relevant,
        eligible,
        queued,
        analyzed,
        failed,
        recommendations: {
          APPLY_NOW: applyNow,
          STRONG_MATCH: strong,
          CONSIDER: consider,
          LOW_PRIORITY: low,
          SKIP: skip,
        },
        workers,
        metrics,
        samples,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
