const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const slugs = ['highradius', 'cloudera', 'observe-ai', 'gainsight', 'fampay', 'fi-money', 'posthog', 'atlan', 'meilisearch'];
  const companies = await prisma.company.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, enabled: true, _count: { select: { jobs: true } } }
  });
  console.log(companies);
}

check().then(() => prisma.$disconnect());
