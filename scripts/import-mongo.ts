import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";

type Dump = {
  companies: Record<string, unknown>[];
  jobs: Record<string, unknown>[];
  preferences: Record<string, unknown>[];
  scanRuns: Record<string, unknown>[];
  scanLogs: Record<string, unknown>[];
};

const DATE_KEYS = new Set([
  "lastCheckedAt",
  "postedAt",
  "discoveredAt",
  "lastSeenAt",
  "seenAt",
  "savedAt",
  "appliedAt",
  "interviewAt",
  "offerAt",
  "rejectedAt",
  "startedAt",
  "finishedAt",
  "createdAt",
  "updatedAt",
]);

function revive(row: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (DATE_KEYS.has(key) && typeof value === "string") {
      next[key] = new Date(value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

async function insertMany(
  label: string,
  rows: Record<string, unknown>[],
  createMany: (data: Record<string, unknown>[]) => Promise<{ count: number }>
) {
  const revived = rows.map(revive);
  const batchSize = 250;
  let count = 0;
  for (let i = 0; i < revived.length; i += batchSize) {
    const batch = revived.slice(i, i + batchSize);
    const result = await createMany(batch);
    count += result.count;
    console.log(`${label}: ${count}/${revived.length}`);
  }
}

async function main() {
  const dump = JSON.parse(readFileSync("prisma/sqlite-export.json", "utf8")) as Dump;

  await prisma.scanLog.deleteMany();
  await prisma.job.deleteMany();
  await prisma.scanRun.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.company.deleteMany();

  await insertMany("companies", dump.companies, (data) =>
    prisma.company.createMany({ data: data as never })
  );
  await insertMany("preferences", dump.preferences, (data) =>
    prisma.preference.createMany({ data: data as never })
  );
  await insertMany("scanRuns", dump.scanRuns, (data) =>
    prisma.scanRun.createMany({ data: data as never })
  );
  await insertMany("jobs", dump.jobs, (data) => prisma.job.createMany({ data: data as never }));
  await insertMany("scanLogs", dump.scanLogs, (data) =>
    prisma.scanLog.createMany({ data: data as never })
  );

  const [companies, jobs, preferences] = await Promise.all([
    prisma.company.count(),
    prisma.job.count(),
    prisma.preference.count(),
  ]);
  console.log({ companies, jobs, preferences });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
