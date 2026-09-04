import { prisma } from "@/lib/db";
import { json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const prefs = await getPreferences(user && user.role !== "superadmin" ? user.id : null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const locationFilter = !prefs.allowInternational
    ? {
        OR: [
          { country: { contains: "India", mode: "insensitive" as const } },
          { city: { contains: "Bangalore", mode: "insensitive" as const } },
          { city: { contains: "Bengaluru", mode: "insensitive" as const } },
          { city: { contains: "Hyderabad", mode: "insensitive" as const } },
          { city: { contains: "Pune", mode: "insensitive" as const } },
          { city: { contains: "Mumbai", mode: "insensitive" as const } },
          { city: { contains: "Delhi", mode: "insensitive" as const } },
          { city: { contains: "Chennai", mode: "insensitive" as const } },
          { city: { contains: "Gurgaon", mode: "insensitive" as const } },
          { city: { contains: "Gurugram", mode: "insensitive" as const } },
          { city: { contains: "Noida", mode: "insensitive" as const } },
          { location: { contains: "India", mode: "insensitive" as const } },
          { AND: [{ remoteType: "remote" }, { location: { contains: "India", mode: "insensitive" as const } }] },
        ],
      }
    : {};

  const [relevant, newToday, excellent, saved, applied] = await Promise.all([
    prisma.job.count({
      where: {
        isActive: true,
        isRelevant: true,
        relevanceScore: { gte: prefs.minimumRelevanceScore },
        ...locationFilter,
      },
    }),
    prisma.job.count({
      where: { isActive: true, discoveredAt: { gte: today }, ...locationFilter },
    }),
    prisma.job.count({
      where: { isActive: true, isRelevant: true, relevanceScore: { gte: 90 }, ...locationFilter },
    }),
    user
      ? prisma.userJob.count({ where: { userId: user.id, status: "saved" } })
      : prisma.job.count({ where: { userStatus: "saved" } }),
    user
      ? prisma.userJob.count({ where: { userId: user.id, status: "applied" } })
      : prisma.job.count({ where: { userStatus: "applied" } }),
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
