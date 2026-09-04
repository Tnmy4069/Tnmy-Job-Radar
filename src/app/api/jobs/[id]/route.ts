import { prisma } from "@/lib/db";
import { json, notFound } from "@/lib/api";
import { serializeJob } from "../route";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!job) return notFound("Job not found");
  return json({ job: serializeJob(job) });
}
