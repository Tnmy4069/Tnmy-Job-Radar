import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound } from "@/lib/api";

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
  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("Invalid status");

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFound("Job not found");

  const stampField = STATUS_TIMESTAMP[body.data.status];
  const data: Record<string, unknown> = {
    userStatus: body.data.status,
    isNew: false,
  };
  if (stampField) {
    data[stampField] = new Date();
  }

  const updated = await prisma.job.update({
    where: { id },
    data,
  });
  return json({ id: updated.id, userStatus: updated.userStatus });
}
