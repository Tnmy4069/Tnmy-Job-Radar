import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json } from "@/lib/api";
import { getPreferences } from "@/lib/preferences";
import { rescoreStoredJobs } from "@/lib/scanner/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  targetTitles: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  targetSkills: z.array(z.string()).optional(),
  additionalSkills: z.array(z.string()).optional(),
  experienceLevel: z.string().optional(),
  remotePreference: z.string().optional(),
  excludedKeywords: z.array(z.string()).optional(),
  minimumRelevanceScore: z.number().min(0).max(100).optional(),
  scanFrequency: z.enum(["manual", "6h", "12h", "daily"]).optional(),
  includeSeniorRoles: z.boolean().optional(),
  allowInternational: z.boolean().optional(),
  notifyMinScore: z.number().min(0).max(100).optional(),
});

export async function GET() {
  return json({ preferences: await getPreferences() });
}

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid preferences");

  const data = parsed.data;
  const updated = await prisma.preference.upsert({
    where: { id: "default" },
    update: {
      ...(data.targetTitles ? { targetTitles: JSON.stringify(data.targetTitles) } : {}),
      ...(data.targetLocations ? { targetLocations: JSON.stringify(data.targetLocations) } : {}),
      ...(data.targetSkills ? { targetSkills: JSON.stringify(data.targetSkills) } : {}),
      ...(data.additionalSkills ? { additionalSkills: JSON.stringify(data.additionalSkills) } : {}),
      ...(data.excludedKeywords ? { excludedKeywords: JSON.stringify(data.excludedKeywords) } : {}),
      ...(data.experienceLevel ? { experienceLevel: data.experienceLevel } : {}),
      ...(data.remotePreference ? { remotePreference: data.remotePreference } : {}),
      ...(data.minimumRelevanceScore !== undefined
        ? { minimumRelevanceScore: data.minimumRelevanceScore }
        : {}),
      ...(data.scanFrequency ? { scanFrequency: data.scanFrequency } : {}),
      ...(data.includeSeniorRoles !== undefined
        ? { includeSeniorRoles: data.includeSeniorRoles }
        : {}),
      ...(data.allowInternational !== undefined
        ? { allowInternational: data.allowInternational }
        : {}),
      ...(data.notifyMinScore !== undefined ? { notifyMinScore: data.notifyMinScore } : {}),
    },
    create: { id: "default" },
  });

  await rescoreStoredJobs();
  return json({ preferences: await getPreferences(), id: updated.id });
}
