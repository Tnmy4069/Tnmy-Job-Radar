import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Unknown";
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export function daysAgo(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function formatScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function scoreTone(score: number) {
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 80) return "text-sky-600 dark:text-sky-400";
  if (score >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function companyLogo(domainOrUrl: string): string {
  const domain = domainOrUrl.includes("://") ? domainFromUrl(domainOrUrl) : domainOrUrl;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/** Prefer postedAt; if missing, show discovered separately. */
export function formatJobFreshness(
  postedAt: Date | string | null | undefined,
  discoveredAt: Date | string | null | undefined
): string {
  if (postedAt) {
    const ago = timeAgo(postedAt);
    if (ago === "just now") return "Posted today";
    if (ago === "yesterday") return "Posted yesterday";
    return `Posted ${ago}`;
  }
  const discovered = timeAgo(discoveredAt);
  return `Posted date unavailable · Discovered ${discovered}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}
