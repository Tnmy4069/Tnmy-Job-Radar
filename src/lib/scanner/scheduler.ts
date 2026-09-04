import { frequencyToMs, getPreferences } from "@/lib/preferences";
import { prisma } from "@/lib/db";
import { isScanRunning, runScan } from "./service";

let timer: NodeJS.Timeout | null = null;
let started = false;

export function startLocalScheduler() {
  if (started || process.env.DISABLE_LOCAL_SCHEDULER === "1") return;
  started = true;

  const tick = async () => {
    try {
      if (isScanRunning()) return;
      const prefs = await getPreferences();
      const interval = frequencyToMs(prefs.scanFrequency);
      if (!interval) return;
      const last = await prisma.scanRun.findFirst({
        where: { status: "completed" },
        orderBy: { startedAt: "desc" },
      });
      if (last && Date.now() - last.startedAt.getTime() < interval) return;
      await runScan("scheduled");
    } catch (error) {
      console.error("[scheduler]", error);
    }
  };

  timer = setInterval(tick, 5 * 60 * 1000);
  void tick();
}

export function stopLocalScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
