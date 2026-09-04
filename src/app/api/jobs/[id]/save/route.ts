import { prisma } from "@/lib/db";
import { json, notFound } from "@/lib/api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFound("Job not found");
  const next = job.userStatus === "saved" ? "seen" : "saved";
  const updated = await prisma.job.update({
    where: { id },
    data: {
      userStatus: next,
      isNew: false,
      ...(next === "saved" ? { savedAt: new Date() } : { seenAt: new Date() }),
    },
  });
  return json({ id: updated.id, userStatus: updated.userStatus });
}
