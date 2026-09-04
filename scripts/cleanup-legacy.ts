import { prisma } from "../src/lib/db";

async function main() {
  const r = await prisma.job.updateMany({
    where: {
      OR: [{ searchText: "" }, { city: "" }],
      isActive: true,
    },
    data: { isActive: false, isNew: false },
  });
  console.log("Deactivated legacy rows", r.count);
  const [active, relevant, isNew] = await Promise.all([
    prisma.job.count({ where: { isActive: true } }),
    prisma.job.count({ where: { isActive: true, isRelevant: true } }),
    prisma.job.count({ where: { isActive: true, isNew: true } }),
  ]);
  console.log({ active, relevant, isNew });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
