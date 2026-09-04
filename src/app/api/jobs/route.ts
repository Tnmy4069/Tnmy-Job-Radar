import type { Prisma } from "@prisma/client";
import { contains, prisma } from "@/lib/db";
import { json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { ROLE_FILTERS } from "@/lib/relevance/defaults";
import { getPreferences } from "@/lib/preferences";
import { citySortKey, countrySortKey } from "@/lib/location";
import { jobMatchesExcluded, parseSearchQuery, rankSearchJob } from "@/lib/search";
import { serializeJobAi } from "@/lib/ai/dto";
import { JOB_CARD_SELECT } from "@/lib/jobs/list-select";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const minScore = Number(searchParams.get("minScore") ?? 0);
  const experience = searchParams.get("experience") ?? "";
  const location = searchParams.get("location") ?? "";
  const role = searchParams.get("role") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const freshness = searchParams.get("freshness") ?? "";
  const status = searchParams.get("status") ?? "";
  const company = searchParams.get("company") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const relevant = searchParams.get("relevant");
  const isNew = searchParams.get("isNew");
  const active = searchParams.get("active") ?? "true";

  const user = await getCurrentUser();
  const prefs = await getPreferences(user && user.role !== "superadmin" ? user.id : null);
  const parsed = parseSearchQuery(q);
  const forceSearch = parsed.tokens.length > 0;

  const where: Prisma.JobWhereInput = {};
  if (active === "true") where.isActive = true;
  if (!forceSearch && relevant === "true") where.isRelevant = true;
  if (isNew === "true") where.isNew = true;
  if (!forceSearch && minScore > 0) where.relevanceScore = { gte: minScore };
  if (status) {
    if (user) {
      const tracked = await prisma.userJob.findMany({
        where: { userId: user.id, status },
        select: { jobId: true },
      });
      where.id = { in: tracked.length ? tracked.map((row) => row.jobId) : ["__none__"] };
    } else {
      where.userStatus = status;
    }
  }

  const companyFilter: Prisma.CompanyWhereInput = {};
  if (company) companyFilter.slug = company;
  if (tier) companyFilter.tier = tier;
  if (Object.keys(companyFilter).length) where.company = companyFilter;

  if (!prefs.allowInternational && !forceSearch) {
    where.OR = [
      { country: contains("India") },
      { city: contains("Bangalore") },
      { city: contains("Hyderabad") },
      { city: contains("Pune") },
      { city: contains("Mumbai") },
      { city: contains("Delhi") },
      { city: contains("Chennai") },
      { city: contains("Gurgaon") },
      { location: contains("India") },
      { AND: [{ remoteType: "remote" }, { location: contains("India") }] },
    ];
  }

  const locationAliases: Record<string, string[]> = {
    bangalore: ["bangalore", "bengaluru"],
    hyderabad: ["hyderabad"],
    pune: ["pune"],
    mumbai: ["mumbai"],
    ncr: ["delhi", "ncr", "gurgaon", "gurugram", "noida"],
    chennai: ["chennai"],
    remote: ["remote"],
  };
  if (location) {
    const terms = locationAliases[location.toLowerCase()] ?? [location];
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: terms.flatMap((term) => [
          { city: contains(term) },
          { location: contains(term) },
          { country: contains(term) },
          { remoteType: contains(term) },
        ]),
      },
    ];
  }

  if (freshness) {
    const days =
      freshness === "today" ? 1 : freshness === "3d" ? 3 : freshness === "7d" ? 7 : 30;
    const since = new Date(Date.now() - days * 86_400_000);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [{ postedAt: { gte: since } }, { postedAt: null, discoveredAt: { gte: since } }],
      },
    ];
  }

  if (forceSearch) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: parsed.expanded.flatMap((token) => [
          { searchText: contains(token) },
          { title: contains(token) },
        ]),
      },
    ];
  }

  const needsMemoryFilter =
    Boolean(experience || role) || sort === "country" || sort === "location" || forceSearch;

  const orderBy: Prisma.JobOrderByWithRelationInput[] =
    sort === "newest"
      ? [{ postedAt: "desc" }, { discoveredAt: "desc" }]
      : sort === "company"
        ? [{ company: { name: "asc" } }]
        : sort === "location"
          ? [{ city: "asc" }, { relevanceScore: "desc" }]
          : sort === "country"
            ? [{ country: "asc" }, { city: "asc" }, { relevanceScore: "desc" }]
            : [{ relevanceScore: "desc" }, { postedAt: "desc" }, { discoveredAt: "desc" }];

  if (!needsMemoryFilter) {
    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        select: JOB_CARD_SELECT,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const statuses = await loadUserStatuses(user?.id, jobs.map((job) => job.id));
    return json({
      jobs: jobs.map((job) =>
        serializeJob(job, { excerpt: true, userStatus: statuses.get(job.id) ?? (user ? "unseen" : job.userStatus) })
      ),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }

  // Experience / role filters still need a bounded in-memory pass
  const jobs = await prisma.job.findMany({
    where,
    select: { ...JOB_CARD_SELECT, description: true },
    orderBy,
    take: 400,
  });

  const filtered = jobs.filter((job) => {
    if (jobMatchesExcluded(job.title, prefs)) return false;
    if (experience === "new-grad") {
      const blob = `${job.title} ${job.experienceLevel} ${job.description}`.toLowerCase();
      if (!/new grad|early career|graduate|entry|junior|0-2|0–2/.test(blob)) return false;
    }
    if (experience === "0-2") {
      if (job.experienceLevel === "senior" || job.experienceLevel === "mid") return false;
    }
    if (experience === "2-3") {
      if (!/2-3|2–3|mid|sde ii|engineer ii/.test(`${job.title} ${job.description}`.toLowerCase())) {
        return false;
      }
    }
    if (role) {
      const filter = ROLE_FILTERS.find((item) => item.id === role);
      if (filter && !filter.pattern.test(`${job.title} ${job.department} ${job.description}`)) {
        return false;
      }
    }
    return true;
  });

  if (forceSearch && sort === "best") {
    filtered.sort(
      (a, b) => rankSearchJob(b, parsed, prefs) - rankSearchJob(a, parsed, prefs)
    );
  }

  if (sort === "country" || sort === "location") {
    filtered.sort((a, b) => {
      if (sort === "country") {
        const countryCmp = countrySortKey(a.country).localeCompare(countrySortKey(b.country));
        if (countryCmp !== 0) return countryCmp;
        const cityCmp = citySortKey(a.city).localeCompare(citySortKey(b.city));
        if (cityCmp !== 0) return cityCmp;
        return b.relevanceScore - a.relevanceScore;
      }
      const cityCmp = citySortKey(a.city).localeCompare(citySortKey(b.city));
      if (cityCmp !== 0) return cityCmp;
      return b.relevanceScore - a.relevanceScore;
    });
  }

  const start = (page - 1) * pageSize;
  const pageJobs = filtered.slice(start, start + pageSize);
  const statuses = await loadUserStatuses(user?.id, pageJobs.map((job) => job.id));
  const pageItems = pageJobs.map((job) =>
    serializeJob(job, { excerpt: true, userStatus: statuses.get(job.id) ?? (user ? "unseen" : job.userStatus) })
  );

  return json({
    jobs: pageItems,
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    forceSearch,
  });
}

export function serializeJob(
  job: {
    id: string;
    title: string;
    description?: string;
    location: string;
    rawLocation?: string;
    city?: string;
    country: string;
    employmentType: string;
    experienceLevel: string;
    department: string;
    team: string;
    skills: string;
    salary: string | null;
    remoteType: string;
    applicationUrl: string;
    sourceUrl: string;
    sourceType: string;
    postedAt: Date | null;
    discoveredAt: Date;
    lastSeenAt: Date;
    isNew: boolean;
    isActive: boolean;
    isRelevant: boolean;
    relevanceScore: number;
    matchReasons: string;
    userStatus: string;
    aiFitScore?: number | null;
    aiRecommendation?: string | null;
    aiSummary?: string | null;
    aiStrengths?: string | null;
    aiGaps?: string | null;
    aiConcerns?: string | null;
    aiReasoning?: string | null;
    aiExperienceFit?: string | null;
    aiSkillFit?: string | null;
    aiRoleFit?: string | null;
    aiLocationFit?: string | null;
    aiRequiredSkillsMatched?: string | null;
    aiRequiredSkillsMissing?: string | null;
    aiPreferredSkillsMatched?: string | null;
    aiPreferredSkillsMissing?: string | null;
    aiSeniority?: string | null;
    aiIsEarlyCareer?: boolean | null;
    aiRequiresSignificantExperience?: boolean | null;
    aiStatus?: string | null;
    aiAnalyzedAt?: Date | null;
    aiModel?: string | null;
    priorityScore?: number | null;
    company: {
      id: string;
      name: string;
      slug: string;
      logo: string | null;
      tier: string;
      careersUrl: string;
      [key: string]: unknown;
    };
  },
  options: { excerpt?: boolean; userStatus?: string } = {}
) {
  const rawDescription = job.description ?? "";
  const description = options.excerpt
    ? rawDescription.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280)
    : rawDescription;
  return {
    id: job.id,
    title: job.title,
    description,
    location: job.location,
    rawLocation: job.rawLocation || job.location,
    city: job.city || "",
    country: job.country,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    department: job.department,
    team: job.team,
    skills: parseJsonArray(job.skills),
    salary: job.salary,
    remoteType: job.remoteType,
    applicationUrl: job.applicationUrl,
    sourceUrl: job.sourceUrl,
    sourceType: job.sourceType,
    postedAt: job.postedAt,
    discoveredAt: job.discoveredAt,
    lastSeenAt: job.lastSeenAt,
    isNew: job.isNew,
    isActive: job.isActive,
    isRelevant: job.isRelevant,
    relevanceScore: job.relevanceScore,
    matchReasons: parseJsonArray(job.matchReasons),
    userStatus: options.userStatus ?? job.userStatus,
    ...serializeJobAi(job),
    company: {
      id: job.company.id,
      name: job.company.name,
      slug: job.company.slug,
      logo: job.company.logo,
      tier: job.company.tier,
      careersUrl: job.company.careersUrl,
    },
  };
}

async function loadUserStatuses(userId: string | undefined, jobIds: string[]) {
  const map = new Map<string, string>();
  if (!userId || !jobIds.length) return map;
  const rows = await prisma.userJob.findMany({
    where: { userId, jobId: { in: jobIds } },
    select: { jobId: true, status: true },
  });
  for (const row of rows) map.set(row.jobId, row.status);
  return map;
}
