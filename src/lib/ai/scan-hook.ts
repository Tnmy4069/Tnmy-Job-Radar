export function scheduleAiAfterScan() {
  void runPostScanAi();
}

export async function runPostScanAi() {
  try {
    const { analyzeTopRelevantJobs } = await import("./queue");
    await analyzeTopRelevantJobs();
  } catch (error) {
    console.error("[ai] post-scan enqueue failed", error instanceof Error ? error.message : "error");
  }
}
