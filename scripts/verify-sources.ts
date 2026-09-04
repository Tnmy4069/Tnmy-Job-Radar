import { prisma } from "../src/lib/db";
import { PRESERVE_UNSUPPORTED, PRESERVE_VERIFIED, ALL_COMPANY_SEEDS } from "../src/lib/seed/companies";
import { seedDatabase } from "../src/lib/seed/run";
import { verifyCompanySource, verifyCompanySources } from "../src/lib/companies/verify";
import { runScan } from "../src/lib/scanner/service";

async function coverageSnapshot() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      sourceType: true,
      sourceStatus: true,
      enabled: true,
      jobsFetched: true,
      sourceVerifiedAt: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      lastCheckedAt: true,
      lastError: true,
      consecutiveFailures: true,
      sourceNotes: true,
      careersUrl: true,
    },
  });
  const statusCounts: Record<string, number> = {};
  const ats: Record<string, number> = {};
  for (const row of companies) {
    statusCounts[row.sourceStatus] = (statusCounts[row.sourceStatus] ?? 0) + 1;
    ats[row.sourceType] = (ats[row.sourceType] ?? 0) + 1;
  }
  return { companies, statusCounts, ats };
}

async function main() {
  process.env.SOURCE_REQUEST_DELAY_MS ??= "400";
  process.env.SOURCE_VERIFY_CONCURRENCY ??= "3";
  process.env.SCAN_CONCURRENCY ??= "2";
  process.env.COMPANY_SCAN_TIMEOUT_MS ??= "45000";

  const seeded = await seedDatabase();
  console.log(`Tracked in seed: ${seeded.companies}`);

  const results = await verifyCompanySources({ onlyUnverified: true, enableIfVerified: true });

  for (const slug of PRESERVE_UNSUPPORTED) {
    try {
      const row = await verifyCompanySource(slug, { enableIfVerified: false });
      if (row.sourceStatus !== "VERIFIED") {
        await prisma.company.update({
          where: { slug },
          data: {
            enabled: false,
            sourceStatus: "UNSUPPORTED",
            sourceNotes: row.error || "Official source still unsupported by current adapters",
          },
        });
      }
    } catch (error) {
      await prisma.company.update({
        where: { slug },
        data: {
          enabled: false,
          sourceStatus: "UNSUPPORTED",
          sourceNotes: error instanceof Error ? error.message : "Official source still unsupported",
        },
      });
    }
  }

  await prisma.company.updateMany({
    where: { sourceStatus: { not: "VERIFIED" } },
    data: { enabled: false },
  });
  await prisma.company.updateMany({
    where: { sourceStatus: "VERIFIED" },
    data: { enabled: true },
  });

  const snapshot = await coverageSnapshot();
  const newlyVerified = results.filter((row) => row.sourceStatus === "VERIFIED").map((row) => row.slug);

  let scan: Awaited<ReturnType<typeof runScan>> | null = null;
  const enabledCount = await prisma.company.count({ where: { enabled: true } });
  if (enabledCount > 0) {
    scan = await runScan("manual");
  }

  const slowest = await prisma.scanLog.findMany({
    where: scan && "runId" in scan && scan.runId ? { runId: scan.runId } : undefined,
    orderBy: { durationMs: "desc" },
    take: 8,
    include: { company: { select: { name: true, slug: true } } },
  });

  const excellent = await prisma.job.count({ where: { isActive: true, isRelevant: true, relevanceScore: { gte: 90 } } });

  console.log(
    JSON.stringify(
      {
        alreadyPresentBeforeThisRun: "see database; seed does not delete existing companies",
        trackedInSeed: ALL_COMPANY_SEEDS.length,
        verificationAttempted: results.length,
        newlyVerifiedThisRun: newlyVerified,
        statusCounts: snapshot.statusCounts,
        ats: snapshot.ats,
        verified: snapshot.companies
          .filter((row) => row.sourceStatus === "VERIFIED")
          .map((row) => `${row.name} — VERIFIED (${row.sourceType}, jobs ${row.jobsFetched})`),
        unverified: snapshot.companies.filter((row) => row.sourceStatus === "UNVERIFIED").map((row) => row.name),
        unsupported: snapshot.companies
          .filter((row) => row.sourceStatus === "UNSUPPORTED")
          .map((row) => `${row.name} — ${row.sourceNotes || "unsupported"} · ${row.careersUrl}`),
        failed: snapshot.companies
          .filter((row) => row.sourceStatus === "FAILED")
          .map((row) => `${row.name} — ${row.lastError || "failed"} · failures ${row.consecutiveFailures}`),
        scan,
        excellentJobs: excellent,
        slowestSources: slowest.map((row) => ({
          company: row.company?.name ?? row.companyId,
          durationMs: row.durationMs,
          status: row.status,
          fetched: row.fetched,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
