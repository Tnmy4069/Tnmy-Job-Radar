import { createHash } from "crypto";

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function jobFingerprint(input: {
  company: string;
  title: string;
  location: string;
  applicationUrl: string;
  externalId?: string | null;
  city?: string;
}): string {
  if (input.externalId) {
    const raw = [normalizeText(input.company), String(input.externalId).trim()].join("|");
    return createHash("sha256").update(raw).digest("hex");
  }

  const locationPart = normalizeText(input.city || input.location);
  const raw = [
    normalizeText(input.company),
    normalizeText(input.title),
    locationPart,
    input.applicationUrl.trim().toLowerCase().split("?")[0],
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export function buildSearchText(parts: {
  title: string;
  company: string;
  city?: string;
  country?: string;
  location?: string;
  skills?: string[];
  description?: string;
}): string {
  const desc = (parts.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
  return [
    parts.title,
    parts.company,
    parts.city,
    parts.country,
    parts.location,
    ...(parts.skills ?? []),
    desc,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
