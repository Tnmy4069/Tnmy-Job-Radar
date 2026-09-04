export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Vercel/serverless: skip seed + background workers on every cold start.
  if (process.env.VERCEL) return;

  const { seedDatabase } = await import("./lib/seed/run");
  const { startLocalScheduler } = await import("./lib/scanner/scheduler");
  try {
    await seedDatabase();
  } catch (error) {
    console.error("[seed] failed to sync companies", error);
  }
  startLocalScheduler();
  try {
    const { kickAiWorkers } = await import("./lib/ai/queue");
    kickAiWorkers();
  } catch (error) {
    console.error("[ai] worker start failed", error instanceof Error ? error.message : error);
  }
}
