import { after } from "next/server";
import { json } from "@/lib/api";
import { serializeJob } from "@/app/api/jobs/route";
import { analyzeRecommendedJobs, getRecommendedJobs } from "@/lib/ai/recommended";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 12);
  const analyze = searchParams.get("analyze") === "1";

  if (analyze) {
    after(() => {
      void analyzeRecommendedJobs(limit);
    });
  }

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
  const pending = jobs.filter((job) => job.aiStatus !== "ANALYZED").length;
  return json({
    jobs: jobs.map((job) =>
      serializeJob(
        { ...job, description: "" },
        { excerpt: true, userStatus: statuses.get(job.id) ?? (user ? "unseen" : job.userStatus) }
      )
    ),
    analyzing: analyze && pending > 0,
  });
}
