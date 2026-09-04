import { browserTimeoutMs, browserFetchEnabled } from "./config";

/**
 * Optional official-page rendering for JS shells.
 * Never enabled on Vercel. Never uses stealth, proxies, or challenge bypass.
 */
export async function fetchRenderedHtml(url: string): Promise<string | null> {
  if (!browserFetchEnabled()) return null;

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    return null;
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({
      userAgent:
        "JobRadar/1.0 (+https://localhost; personal job discovery; respects robots; not a commercial scraper)",
    });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: browserTimeoutMs(),
    });
    await page.waitForLoadState("networkidle", { timeout: browserTimeoutMs() }).catch(() => undefined);

    for (let i = 0; i < 8; i += 1) {
      const clicked = await page
        .getByRole("button", { name: /load more|show more/i })
        .first()
        .click({ timeout: 1500 })
        .then(() => true)
        .catch(() => false);
      if (!clicked) break;
      await page.waitForTimeout(500);
    }

    return await page.content();
  } finally {
    await browser.close();
  }
}
