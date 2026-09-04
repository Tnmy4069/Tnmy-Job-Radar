import { prisma } from "@/lib/db";
import { json, notFound } from "@/lib/api";
import { serializeJob } from "@/app/api/jobs/route";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "relevant";

  const company = await prisma.company.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!company) return notFound("Company not found");

  const where =
    view === "new"
      ? { companyId: company.id, isActive: true, isNew: true }
      : view === "all"
        ? { companyId: company.id, isActive: true }
        : { companyId: company.id, isActive: true, isRelevant: true };

  const [jobs, relevant, isNew, all, active] = await Promise.all([
    prisma.job.findMany({
      where,
      include: { company: true },
      orderBy: [{ relevanceScore: "desc" }, { postedAt: "desc" }],
      take: 50,
    }),
    prisma.job.count({ where: { companyId: company.id, isActive: true, isRelevant: true } }),
    prisma.job.count({ where: { companyId: company.id, isActive: true, isNew: true } }),
    prisma.job.count({ where: { companyId: company.id } }),
    prisma.job.count({ where: { companyId: company.id, isActive: true } }),
  ]);

  return json({
    company: {
      ...company,
      sourceConfig: JSON.parse(company.sourceConfig || "{}"),
      relevant,
      isNew,
      all,
      active,
    },
    jobs: jobs.map((job) => serializeJob(job, { excerpt: true })),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  const company = await prisma.company.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!company) return notFound("Company not found");
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: { enabled: Boolean(body.enabled) },
  });
  return json({ company: updated });
}
