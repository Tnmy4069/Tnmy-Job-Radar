import { prisma } from "../src/lib/db";
import { seedDatabase } from "../src/lib/seed/run";

const ENABLE = [
  "google",
  "microsoft",
  "amazon",
  "adobe",
  "atlassian",
  "stripe",
  "datadog",
  "cloudflare",
  "figma",
  "nvidia",
  "gitlab",
  "twilio",
  "notion",
  "dropbox",
  "okta",
  "elastic",
  "openai",
  "databricks",
  "glean",
];

async function main() {
  await seedDatabase();
  const result = await prisma.company.updateMany({
    where: { slug: { in: ENABLE } },
    data: { enabled: true },
  });
  // Apply glean token fix
  await prisma.company.update({
    where: { slug: "glean" },
    data: { sourceConfig: JSON.stringify({ boardToken: "gleanwork" }) },
  });
  console.log(`Enabled ${result.count} verified companies`);
  const enabled = await prisma.company.findMany({
    where: { enabled: true },
    select: { slug: true, sourceType: true },
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
