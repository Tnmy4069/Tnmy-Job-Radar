import { prisma } from "@/lib/db";
import { json, notFound } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireUser();
  if (response || !user) return response;

  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFound("Job not found");

  const existing = await prisma.userJob.findUnique({
    where: { userId_jobId: { userId: user.id, jobId: id } },
  });
  const next = existing?.status === "saved" ? "seen" : "saved";
  const updated = await prisma.userJob.upsert({
    where: { userId_jobId: { userId: user.id, jobId: id } },
    update: {
      status: next,
      ...(next === "saved" ? { savedAt: new Date() } : { seenAt: new Date() }),
    },
    create: {
      userId: user.id,
      jobId: id,
      status: next,
      ...(next === "saved" ? { savedAt: new Date() } : { seenAt: new Date() }),
    },
  });
  return json({ id: job.id, userStatus: updated.status });
}
