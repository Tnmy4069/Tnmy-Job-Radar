import { json } from "@/lib/api";
import { serializeJob } from "@/app/api/jobs/route";
import { getRecommendedJobs } from "@/lib/ai/recommended";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 16);
  const jobs = await getRecommendedJobs(limit);
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
    jobs: jobs.map((job) =>
      serializeJob(job, { excerpt: true, userStatus: statuses.get(job.id) ?? (user ? "unseen" : job.userStatus) })
    ),
  });
}
