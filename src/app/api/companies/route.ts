import { prisma } from "@/lib/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: [{ tier: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          jobs: true,
        },
      },
    },
  });

  const stats = await Promise.all(
    companies.map(async (company) => {
      const [relevant, isNew] = await Promise.all([
        prisma.job.count({ where: { companyId: company.id, isActive: true, isRelevant: true } }),
        prisma.job.count({ where: { companyId: company.id, isActive: true, isNew: true } }),
      ]);
      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo: company.logo,
        careersUrl: company.careersUrl,
        sourceType: company.sourceType,
        tier: company.tier,
        enabled: company.enabled,
        lastCheckedAt: company.lastCheckedAt,
        checkStatus: company.checkStatus,
        lastError: company.lastError,
        jobsFound: company._count.jobs,
        relevant,
        isNew,
      };
    })
  );

  return json({ companies: stats });
}
