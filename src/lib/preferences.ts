import { prisma } from "@/lib/db";
import {
  ADDITIONAL_SKILLS,
  DEFAULT_EXCLUDED,
  DEFAULT_TITLES,
  PREFERRED_LOCATIONS,
  STRONG_SKILLS,
} from "@/lib/relevance/defaults";
import type { PreferenceInput } from "@/lib/relevance/engine";
import { parseJsonArray } from "@/lib/utils";

export type StoredPreferences = PreferenceInput & { scanFrequency: string; notifyMinScore: number };

function mapPreference(row: {
  targetTitles: string;
  targetLocations: string;
  targetSkills: string;
  additionalSkills: string;
  experienceLevel: string;
  remotePreference: string;
  excludedKeywords: string;
  minimumRelevanceScore: number;
  includeSeniorRoles: boolean;
  allowInternational: boolean;
  scanFrequency: string;
  notifyMinScore: number;
}): StoredPreferences {
  return {
    targetTitles: parseJsonArray(row.targetTitles),
    targetLocations: parseJsonArray(row.targetLocations),
    targetSkills: parseJsonArray(row.targetSkills),
    additionalSkills: parseJsonArray(row.additionalSkills),
    experienceLevel: row.experienceLevel,
    remotePreference: row.remotePreference,
    excludedKeywords: parseJsonArray(row.excludedKeywords),
    minimumRelevanceScore: row.minimumRelevanceScore,
    includeSeniorRoles: row.includeSeniorRoles,
    allowInternational: row.allowInternational,
    scanFrequency: row.scanFrequency,
    notifyMinScore: row.notifyMinScore,
  };
}

const prefCache = new Map<string, { value: StoredPreferences; expires: number }>();

export async function getPreferences(userId?: string | null): Promise<StoredPreferences> {
  const key = userId || "default";
  const cached = prefCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  if (userId) {
    const own = await prisma.preference.findUnique({ where: { id: userId } });
    if (own) {
      const mapped = mapPreference(own);
      prefCache.set(key, { value: mapped, expires: Date.now() + 15_000 });
      return mapped;
    }
  }

  const row =
    (await prisma.preference.findUnique({ where: { id: "default" } })) ??
    (await prisma.preference.create({
      data: {
        id: "default",
        targetTitles: JSON.stringify(DEFAULT_TITLES),
        targetLocations: JSON.stringify(PREFERRED_LOCATIONS),
        targetSkills: JSON.stringify(STRONG_SKILLS),
        additionalSkills: JSON.stringify(ADDITIONAL_SKILLS),
        excludedKeywords: JSON.stringify(DEFAULT_EXCLUDED),
      },
    }));

  const mapped = mapPreference(row);
  prefCache.set(key, { value: mapped, expires: Date.now() + 15_000 });
  return mapped;
}

export function frequencyToMs(value: string): number | null {
  switch (value) {
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "12h":
      return 12 * 60 * 60 * 1000;
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "manual":
    default:
      return null;
  }
}
