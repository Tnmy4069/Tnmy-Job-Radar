import { prisma } from "@/lib/db";
import { badRequest, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listAdapterTypes } from "@/lib/adapters/registry";
import { companyLogo, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          jobs: true,
        },
      },
    },
  });

  const [relevantGroups, newGroups] = await Promise.all([
    prisma.job.groupBy({
      by: ["companyId"],
      where: { isActive: true, isRelevant: true },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ["companyId"],
      where: { isActive: true, isNew: true },
      _count: { _all: true },
    }),
  ]);
  const relevantById = new Map(relevantGroups.map((row) => [row.companyId, row._count._all]));
  const newById = new Map(newGroups.map((row) => [row.companyId, row._count._all]));

  const stats = companies.map((company) => ({
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
    lastBlockReason: company.lastBlockReason,
    lastSuccessAt: company.lastSuccessAt,
    lastFailureAt: company.lastFailureAt,
    failureCount: company.failureCount,
    blockedCount: company.blockedCount,
    rateLimitCount: company.rateLimitCount,
    jobsFetched: company.jobsFetched,
    jobsParsed: company.jobsParsed,
    jobsRejected: company.jobsRejected,
    averageLatencyMs: company.averageLatencyMs,
    sourceStatus: company.sourceStatus,
    category: company.category,
    priority: company.priority,
    indiaHiring: company.indiaHiring,
    sourceVerifiedAt: company.sourceVerifiedAt,
    consecutiveFailures: company.consecutiveFailures,
    sourceNotes: company.sourceNotes,
    jobsFound: company._count.jobs,
    relevant: relevantById.get(company.id) ?? 0,
    isNew: newById.get(company.id) ?? 0,
  }));

  const coverage = {
    tracked: stats.length,
    verified: stats.filter((row) => row.sourceStatus === "VERIFIED").length,
    unverified: stats.filter((row) => row.sourceStatus === "UNVERIFIED").length,
    unsupported: stats.filter((row) => row.sourceStatus === "UNSUPPORTED").length,
    failed: stats.filter((row) => row.sourceStatus === "FAILED").length,
    disabled: stats.filter((row) => !row.enabled || row.sourceStatus === "DISABLED").length,
    ats: stats.reduce<Record<string, number>>((acc, row) => {
      acc[row.sourceType] = (acc[row.sourceType] ?? 0) + 1;
      return acc;
    }, {}),
  };

  return json({ companies: stats, coverage });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    website?: string;
    careersUrl?: string;
    sourceType?: string;
    category?: string;
    priority?: string;
  };

  const name = body.name?.trim() ?? "";
  const careersUrl = body.careersUrl?.trim() ?? "";
  if (!name || !careersUrl) return badRequest("name and careersUrl are required");
  try {
    new URL(careersUrl);
  } catch {
    return badRequest("careersUrl must be an official https URL");
  }

  const slug = slugify(body.slug || name);
  if (!slug) return badRequest("Could not derive a slug");

  const sourceType = listAdapterTypes().includes(body.sourceType as never)
    ? body.sourceType!
    : "generic";

  let host = "";
  try {
    host = new URL(body.website || careersUrl).hostname.replace(/^www\./, "");
  } catch {
    host = slug;
  }

  const duplicate = await prisma.company.findFirst({
    where: {
      OR: [{ slug }, { name }, { website: { contains: host } }],
    },
  });
  if (duplicate) return badRequest(`Company already exists: ${duplicate.name}`);

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      careersUrl,
      website: body.website?.trim() || `https://${host}`,
      sourceType,
      sourceConfig: "{}",
      tier: "saas",
      logo: companyLogo(host),
      enabled: false,
      sourceStatus: "UNVERIFIED",
      category: body.category || "OTHER_PRODUCT",
      priority: body.priority === "A" || body.priority === "C" ? body.priority : "B",
      indiaHiring: "unknown",
      sourceNotes: "Added from admin; source not yet verified",
    },
  });

  return json({ company }, 201);
}
