import { seedDatabase } from "../src/lib/seed/run";
import { runScan, rescoreStoredJobs } from "../src/lib/scanner/service";
import { prisma } from "../src/lib/db";

async function main() {
  await seedDatabase();
  console.log("\n=== SCAN 1 ===");
  const first = await runScan("manual");
  console.log(first);

  console.log("\n=== SCAN 2 (dedupe check) ===");
  const second = await runScan("manual");
  console.log(second);

  console.log("\n=== Rescoring ===");
  await rescoreStoredJobs();

  const [active, relevant, isNew, companies] = await Promise.all([
    prisma.job.count({ where: { isActive: true } }),
    prisma.job.count({ where: { isActive: true, isRelevant: true } }),
    prisma.job.count({ where: { isActive: true, isNew: true } }),
    prisma.company.findMany({
      where: { enabled: true },
      select: { name: true, slug: true, checkStatus: true, lastError: true },
      orderBy: { name: "asc" },
    }),
  ]);

  console.log("\n=== SUMMARY ===");
  const scan2New = second.ok === true && "jobsNew" in second ? second.jobsNew : null;
  console.log({ active, relevant, isNew, scan2New });
  console.log("\nCompanies:");
  for (const c of companies) {
    console.log(`  ${c.checkStatus.padEnd(12)} ${c.name}${c.lastError ? ` — ${c.lastError.slice(0, 80)}` : ""}`);
  }

  const sample = await prisma.job.findMany({
    where: { isActive: true, isRelevant: true },
    include: { company: true },
    orderBy: { relevanceScore: "desc" },
    take: 8,
  });
  console.log("\nTop relevant:");
  for (const j of sample) {
    console.log(
      `  ${j.relevanceScore} ${j.company.name} | ${j.title} | ${j.city}, ${j.country} | ${j.applicationUrl.slice(0, 70)}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
