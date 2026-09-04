import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["unseen", "seen", "saved", "applied", "rejected", "interview", "offer"]),
});

const STATUS_TIMESTAMP: Record<string, string> = {
  seen: "seenAt",
  saved: "savedAt",
  applied: "appliedAt",
  interview: "interviewAt",
  offer: "offerAt",
  rejected: "rejectedAt",
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireUser();
  if (response || !user) return response;

  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Invalid status");

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFound("Job not found");

  const stampField = STATUS_TIMESTAMP[body.data.status];
  const data: Record<string, unknown> = { status: body.data.status };
  if (stampField) data[stampField] = new Date();

  const updated = await prisma.userJob.upsert({
    where: { userId_jobId: { userId: user.id, jobId: id } },
    update: data,
    create: {
      userId: user.id,
      jobId: id,
      ...data,
    },
  });
  return json({ id: job.id, userStatus: updated.status });
}
