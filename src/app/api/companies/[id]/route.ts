import { prisma } from "@/lib/db";
import { json, notFound } from "@/lib/api";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
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

  const user = await getCurrentUser();
  const statuses = new Map<string, string>();
  if (user && jobs.length) {
    const rows = await prisma.userJob.findMany({
      where: { userId: user.id, jobId: { in: jobs.map((job) => job.id) } },
      select: { jobId: true, status: true },
    });
    for (const row of rows) statuses.set(row.jobId, row.status);
  }

  return json({
    company: {
      ...company,
      sourceConfig: JSON.parse(company.sourceConfig || "{}"),
      relevant,
      isNew,
      all,
      active,
    },
    jobs: jobs.map((job) =>
      serializeJob(job, {
        excerpt: true,
        userStatus: statuses.get(job.id) ?? (user ? "unseen" : job.userStatus),
      })
    ),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin();
  if (response) return response;
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
