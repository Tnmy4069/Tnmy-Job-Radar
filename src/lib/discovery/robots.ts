import { JOB_RADAR_HEADERS } from "./config";
import { throttleHost } from "./throttle";

export type RobotsGroup = {
  agents: string[];
  allow: string[];
  disallow: string[];
};

export type RobotsFile = {
  sitemaps: string[];
  groups: RobotsGroup[];
};

const cache = new Map<string, { expiresAt: number; file: RobotsFile | null }>();
const CACHE_MS = 30 * 60 * 1000;
const UA = "jobradar";

export function parseRobotsTxt(text: string): RobotsFile {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let pendingAgents: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      const agent = value.toLowerCase() || "*";
      if (current && (current.allow.length > 0 || current.disallow.length > 0)) {
        pendingAgents = [agent];
        current = null;
      } else if (current) {
        current.agents.push(agent);
      } else {
        pendingAgents.push(agent);
      }
      continue;
    }
    if (key === "allow" || key === "disallow") {
      if (!current) {
        current = {
          agents: pendingAgents.length ? pendingAgents : ["*"],
          allow: [],
          disallow: [],
        };
        pendingAgents = [];
        groups.push(current);
      }
      if (key === "allow") current.allow.push(value);
      else current.disallow.push(value);
    }
  }

  return { sitemaps, groups };
}

function matchingGroup(file: RobotsFile, userAgent: string): RobotsGroup | null {
  const ua = userAgent.toLowerCase();
  const specific = file.groups.find((group) =>
    group.agents.some((agent) => agent !== "*" && (ua.startsWith(agent) || agent.startsWith(ua)))
  );
  if (specific) return specific;
  return file.groups.find((group) => group.agents.includes("*")) ?? null;
}

function longestPrefix(path: string, patterns: string[]): number {
  let best = -1;
  for (const pattern of patterns) {
    if (pattern === "") continue;
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    if (path.startsWith(prefix) || prefix === "/") {
      if (prefix.length > best) best = prefix.length;
    }
    if (pattern === "/" && path.startsWith("/")) {
      best = Math.max(best, 1);
    }
  }
  return best;
}

export function isPathAllowedByRobots(
  pathname: string,
  file: RobotsFile,
  userAgent = UA
): boolean {
  const group = matchingGroup(file, userAgent);
  if (!group) return true;

  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const allowLen = longestPrefix(path, group.allow);
  const disallowLen = longestPrefix(path, group.disallow);

  if (disallowLen < 0) return true;
  return allowLen > disallowLen;
}

export function isUrlAllowedByRobotsFile(url: string, file: RobotsFile, userAgent = UA): boolean {
  try {
    const parsed = new URL(url);
    return isPathAllowedByRobots(`${parsed.pathname}${parsed.search}`, file, userAgent);
  } catch {
    return true;
  }
}

async function loadRobots(origin: string): Promise<RobotsFile | null> {
  const cached = cache.get(origin);
  if (cached && cached.expiresAt > Date.now()) return cached.file;

  let file: RobotsFile | null = null;
  try {
    const robotsUrl = `${origin}/robots.txt`;
    await throttleHost(robotsUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(robotsUrl, {
      headers: { ...JOB_RADAR_HEADERS, Accept: "text/plain, */*;q=0.5" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (response.status === 404) {
      file = { sitemaps: [], groups: [] };
    } else if (response.ok) {
      file = parseRobotsTxt(await response.text());
    }
  } catch {
    file = null;
  }

  cache.set(origin, { expiresAt: Date.now() + CACHE_MS, file });
  return file;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return true;
  }
  const file = await loadRobots(origin);
  if (!file) return true;
  return isUrlAllowedByRobotsFile(url, file);
}

export function resetRobotsCacheForTests() {
  cache.clear();
}
