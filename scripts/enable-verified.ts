import { prisma } from "../src/lib/db";
import { PRESERVE_UNSUPPORTED, PRESERVE_VERIFIED } from "../src/lib/seed/companies";
import { seedDatabase } from "../src/lib/seed/run";

async function main() {
  await seedDatabase();
  const result = await prisma.company.updateMany({
    where: { slug: { in: [...PRESERVE_VERIFIED] } },
    data: { enabled: true, sourceStatus: "VERIFIED" },
  });
  await prisma.company.updateMany({
    where: { slug: { in: [...PRESERVE_UNSUPPORTED] } },
    data: { enabled: false, sourceStatus: "UNSUPPORTED" },
  });
  await prisma.company.update({
    where: { slug: "glean" },
    data: { sourceConfig: JSON.stringify({ boardToken: "gleanwork" }) },
  });
  console.log(`Enabled ${result.count} previously verified companies`);
  const enabled = await prisma.company.findMany({
    where: { enabled: true },
    select: { slug: true, sourceType: true, sourceStatus: true },
    orderBy: { slug: "asc" },
  });
  console.log(enabled);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
