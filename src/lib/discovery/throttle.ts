import { sourceRequestDelayMs } from "./config";

const tails = new Map<string, Promise<unknown>>();
const lastAt = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Serialize requests per host and wait SOURCE_REQUEST_DELAY_MS between them.
 * Does not rotate IPs, spoof fingerprints, or evade rate limits.
 */
export async function throttleHost(url: string, delayMs = sourceRequestDelayMs()): Promise<void> {
  if (delayMs <= 0) return;
  const host = hostOf(url);
  if (!host) return;

  const previous = tails.get(host) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(
    host,
    previous.catch(() => undefined).then(() => current)
  );

  await previous.catch(() => undefined);
  try {
    const wait = delayMs - (Date.now() - (lastAt.get(host) ?? 0));
    if (wait > 0) await sleep(wait);
    lastAt.set(host, Date.now());
  } finally {
    release();
  }
}

export function resetThrottleForTests() {
  tails.clear();
  lastAt.clear();
}
