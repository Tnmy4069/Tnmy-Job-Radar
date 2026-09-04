import { allowManualScan, json } from "@/lib/api";
import { isScanRunning, startScan } from "@/lib/scanner/service";
import { seedDatabase } from "@/lib/seed/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (isScanRunning()) {
    return json({ ok: false, message: "Scan already in progress", running: true }, 409);
  }
  if (!allowManualScan()) {
    return json(
      { ok: false, message: "Scan rate limit reached. Try again in a few minutes." },
      429
    );
  }

  await seedDatabase();
  const body = (await request.json().catch(() => ({}))) as { company?: string };
  const result = await startScan("manual", body.company);
  if (!result.ok) {
    return json(result, 409);
  }
  return json(result);
}
