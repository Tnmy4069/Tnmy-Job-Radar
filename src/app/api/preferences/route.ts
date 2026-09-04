import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/auth";
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
  const user = await getCurrentUser();
  const prefId = user?.role === "superadmin" ? "default" : user?.id;
  return json({
    preferences: await getPreferences(prefId),
    role: user?.role ?? null,
  });
}

export async function PUT(request: Request) {
  const { user, response } = await requireUser();
  if (response || !user) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid preferences");

  const data = parsed.data;
  const isAdmin = user.role === "superadmin";
  const prefId = isAdmin ? "default" : user.id;
  const update = {
    ...(data.targetTitles !== undefined ? { targetTitles: JSON.stringify(data.targetTitles) } : {}),
    ...(data.targetLocations !== undefined
      ? { targetLocations: JSON.stringify(data.targetLocations) }
      : {}),
    ...(data.targetSkills !== undefined ? { targetSkills: JSON.stringify(data.targetSkills) } : {}),
    ...(data.additionalSkills !== undefined
      ? { additionalSkills: JSON.stringify(data.additionalSkills) }
      : {}),
    ...(data.excludedKeywords !== undefined
      ? { excludedKeywords: JSON.stringify(data.excludedKeywords) }
      : {}),
    ...(data.experienceLevel !== undefined ? { experienceLevel: data.experienceLevel } : {}),
    ...(data.remotePreference !== undefined ? { remotePreference: data.remotePreference } : {}),
    ...(data.minimumRelevanceScore !== undefined
      ? { minimumRelevanceScore: data.minimumRelevanceScore }
      : {}),
    ...(data.scanFrequency !== undefined && isAdmin ? { scanFrequency: data.scanFrequency } : {}),
    ...(data.includeSeniorRoles !== undefined
      ? { includeSeniorRoles: data.includeSeniorRoles }
      : {}),
    ...(data.allowInternational !== undefined
      ? { allowInternational: data.allowInternational }
      : {}),
    ...(data.notifyMinScore !== undefined ? { notifyMinScore: data.notifyMinScore } : {}),
    ...(isAdmin ? {} : { userId: user.id }),
  };

  const updated = await prisma.preference.upsert({
    where: { id: prefId },
    update,
    create: {
      id: prefId,
      ...(isAdmin ? {} : { userId: user.id }),
      ...update,
    },
  });

  if (isAdmin) {
    try {
      await rescoreStoredJobs();
    } catch (error) {
      console.error("[preferences] rescore failed", error);
    }
  }
  return json({ preferences: await getPreferences(prefId), id: updated.id, role: user.role });
}
