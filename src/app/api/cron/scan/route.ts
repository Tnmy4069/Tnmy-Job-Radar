import { json } from "@/lib/api";
import { frequencyToMs, getPreferences } from "@/lib/preferences";
import { isScanRunning, startScan } from "@/lib/scanner/service";
import { seedDatabase } from "@/lib/seed/run";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.SCAN_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const token = url.searchParams.get("secret");
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !secret) {
    return json({ error: "SCAN_SECRET is required in production" }, 503);
  }

  if (secret && auth !== `Bearer ${secret}` && token !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (isScanRunning()) {
    return json({ ok: false, message: "Scan already in progress", running: true }, 409);
  }

  const prefs = await getPreferences();
  const interval = frequencyToMs(prefs.scanFrequency);
  if (!interval) {
    return json({ ok: true, skipped: true, reason: "Scan frequency is manual" });
  }

  const last = await prisma.scanRun.findFirst({
    where: { status: "completed" },
    orderBy: { startedAt: "desc" },
  });
  if (last && Date.now() - last.startedAt.getTime() < interval - 60_000) {
    return json({ ok: true, skipped: true, reason: "Not due yet" });
  }

  await seedDatabase();
  const result = await startScan("cron");
  return json(result);
}
