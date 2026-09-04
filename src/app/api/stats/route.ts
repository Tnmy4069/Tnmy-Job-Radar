import { prisma } from "@/lib/db";
import { json } from "@/lib/api";
import { getPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const prefs = await getPreferences();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [relevant, newToday, excellent, saved, applied] = await Promise.all([
    prisma.job.count({
      where: {
        isActive: true,
        isRelevant: true,
        relevanceScore: { gte: prefs.minimumRelevanceScore },
      },
    }),
    prisma.job.count({
      where: { isActive: true, discoveredAt: { gte: today } },
    }),
    prisma.job.count({
      where: { isActive: true, isRelevant: true, relevanceScore: { gte: 90 } },
    }),
    prisma.job.count({ where: { userStatus: "saved" } }),
    prisma.job.count({ where: { userStatus: "applied" } }),
  ]);

  return json({
    relevant,
    newToday,
    excellent,
    saved,
    applied,
    minimumRelevanceScore: prefs.minimumRelevanceScore,
  });
}
