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

export async function getPreferences(): Promise<PreferenceInput & { scanFrequency: string; notifyMinScore: number }> {
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
