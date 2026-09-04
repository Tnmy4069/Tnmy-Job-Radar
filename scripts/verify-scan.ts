import { runScan } from "../src/lib/scanner/service";
import { prisma } from "../src/lib/db";

async function main() {
  const slugs = ["amazon", "adobe", "stripe", "google", "atlassian", "microsoft"];
  for (const slug of slugs) {
    console.log(`\n--- scanning ${slug} ---`);
    const result = await runScan("manual", slug);
    console.log(result);
  }

  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    include: { company: true },
    orderBy: { relevanceScore: "desc" },
    take: 8,
  });
  console.log("\nTop jobs:");
  for (const job of jobs) {
    console.log(
      `${job.relevanceScore} ${job.company.name} | ${job.title} | ${job.location} | ${job.applicationUrl}`
    );
  }

  const companies = await prisma.company.findMany({
    where: { slug: { in: slugs } },
    select: { name: true, checkStatus: true, lastError: true },
  });
  console.log("\nStatuses:", companies);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
