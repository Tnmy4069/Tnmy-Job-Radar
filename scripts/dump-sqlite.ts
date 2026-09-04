import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";

async function main() {
  const data = {
    companies: await prisma.company.findMany(),
    jobs: await prisma.job.findMany(),
    preferences: await prisma.preference.findMany(),
    scanRuns: await prisma.scanRun.findMany(),
    scanLogs: await prisma.scanLog.findMany(),
  };
  writeFileSync("prisma/sqlite-export.json", JSON.stringify(data));
  console.log(
    Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]))
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
