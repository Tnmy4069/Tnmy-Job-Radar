import { daysAgo } from "@/lib/utils";
import type { NormalizedJob } from "@/lib/adapters/types";
import { isIndiaLocation } from "@/lib/location";
import {
  ADDITIONAL_SKILLS,
  DEFAULT_EXCLUDED,
  DEFAULT_TITLES,
  EXCELLENT_TITLE_PATTERNS,
  GOOD_TITLE_PATTERNS,
  LOW_TITLE_PATTERNS,
  PREFERRED_LOCATIONS,
  REJECT_TITLE_PATTERNS,
  RELATED_SKILLS,
  SENIOR_KEYWORDS,
  STRONG_SKILLS,
} from "./defaults";

export type PreferenceInput = {
  targetTitles: string[];
  targetLocations: string[];
  targetSkills: string[];
  additionalSkills: string[];
  experienceLevel: string;
  remotePreference: string;
  excludedKeywords: string[];
  minimumRelevanceScore: number;
  includeSeniorRoles: boolean;
  allowInternational: boolean;
};

export type ScoreResult = {
  score: number;
  reasons: string[];
  isRelevant: boolean;
};

function jobMentionsSkill(hay: string, skills: string[], skill: string): boolean {
  const needle = skill.toLowerCase();
  if (skills.some((item) => item.toLowerCase() === needle)) return true;
  if (needle === "c") return /\bc\b/.test(hay);
  return hay.includes(needle);
}

function includesAny(hay: string, needles: string[]): string | null {
  for (const needle of needles) {
    if (needle && hay.includes(needle.toLowerCase())) return needle;
  }
  return null;
}

function hasSeniorKeyword(title: string, prefs: PreferenceInput): boolean {
  if (prefs.includeSeniorRoles) return false;
  const hay = title.toLowerCase();
  const excluded = (prefs.excludedKeywords.length ? prefs.excludedKeywords : DEFAULT_EXCLUDED).map(
    (k) => k.toLowerCase()
  );
  // Do not reject "Software Engineer II" via roman numeral alone
  if (/\bsoftware engineer\s*ii\b|\bsde\s*ii\b|\bsde\s*2\b/i.test(title)) {
    return includesAny(hay, SENIOR_KEYWORDS.concat(excluded).filter((k) => k !== "lead")) !== null
      ? includesAny(hay, ["senior", "sr.", "sr ", "staff", "principal", "manager", "director", "architect", "head of", "vp "]) !== null
      : false;
  }
  return includesAny(hay, SENIOR_KEYWORDS.concat(excluded)) !== null;
}

function titleScore(title: string, prefs: PreferenceInput, reasons: string[]): number {
  for (const reject of REJECT_TITLE_PATTERNS) {
    if (reject.pattern.test(title) && !/\bsoftware engineer\b|\bsde\b|\bdeveloper\b/i.test(title)) {
      reasons.push(`Not a target role (${reject.label})`);
      return 0;
    }
  }

  if (hasSeniorKeyword(title, prefs)) {
    reasons.push("Senior/excluded title");
    return -25;
  }

  for (const item of EXCELLENT_TITLE_PATTERNS) {
    if (item.pattern.test(title)) {
      reasons.push(item.label);
      return 35;
    }
  }

  const targets = (prefs.targetTitles.length ? prefs.targetTitles : DEFAULT_TITLES).map((t) =>
    t.toLowerCase()
  );
  const hay = title.toLowerCase();
  if (includesAny(hay, targets)) {
    reasons.push(title);
    return 32;
  }

  for (const item of GOOD_TITLE_PATTERNS) {
    if (item.pattern.test(title)) {
      reasons.push(item.label);
      return 22;
    }
  }

  for (const item of LOW_TITLE_PATTERNS) {
    if (item.pattern.test(title)) {
      reasons.push(item.label);
      return 8;
    }
  }

  if (/\bengineer\b|\bdeveloper\b/.test(hay)) {
    reasons.push("Engineering role");
    return 12;
  }

  return 0;
}

function experienceScore(job: NormalizedJob, prefs: PreferenceInput, reasons: string[]): number {
  const hay = `${job.title} ${job.description} ${job.experienceLevel}`.toLowerCase();
  const level = prefs.experienceLevel || "0-2";
  const intern = /\b(intern|internship)\b/.test(hay) && !/\bnew grad|early career|entry/.test(hay);
  const early =
    /\b(new grad|new graduate|university grad|early career|fresh graduate|entry[- ]level|junior|graduate software|0-2|0–2|sde i\b|software engineer i\b)\b/.test(
      hay
    );
  const mid = /\b(3-5|3–5|mid[- ]level|sde ii|sde 2|software engineer ii)\b/.test(hay);
  const senior = /\b(5\+|5-8|6\+|7\+|8\+|10\+|senior|staff|principal)\b/.test(hay);

  if (intern) {
    reasons.push("Internship");
    return level === "new-grad" || level === "0-2" ? 10 : 6;
  }
  if (early) {
    reasons.push("0–2 years / early career");
    if (level === "new-grad" || level === "0-2") return 22;
    if (level === "2-3") return 14;
    return 16;
  }
  if (mid) {
    reasons.push("Mid-level experience");
    if (level === "2-3") return 18;
    if (level === "0-2" || level === "new-grad") return 8;
    return 10;
  }
  if (senior) {
    reasons.push("Senior experience required");
    if (level === "0-2" || level === "new-grad") return 1;
    return 4;
  }
  return level === "0-2" || level === "new-grad" ? 12 : 10;
}

function skillScore(job: NormalizedJob, prefs: PreferenceInput, reasons: string[]): number {
  const strong = prefs.targetSkills.length ? prefs.targetSkills : STRONG_SKILLS;
  const extra = prefs.additionalSkills.length ? prefs.additionalSkills : ADDITIONAL_SKILLS;
  const hay = `${job.title} ${job.description} ${job.skills.join(" ")}`.toLowerCase();
  const found: string[] = [];

  for (const skill of strong) {
    if (jobMentionsSkill(hay, job.skills, skill)) {
      found.push(skill);
      continue;
    }
    const related = RELATED_SKILLS[skill] ?? [];
    if (related.some((item) => jobMentionsSkill(hay, job.skills, item))) {
      found.push(skill);
    }
  }
  for (const skill of extra) {
    if (
      hay.includes(skill.toLowerCase()) ||
      job.skills.some((s) => s.toLowerCase() === skill.toLowerCase())
    ) {
      if (!found.includes(skill)) found.push(skill);
    }
  }

  const unique = [...new Set(found)].slice(0, 8);
  unique.slice(0, 5).forEach((skill) => reasons.push(skill));

  if (unique.length === 0) return 4;
  const strongHits = unique.filter((s) =>
    strong.some((x) => x.toLowerCase() === s.toLowerCase())
  ).length;
  return Math.min(25, 6 + strongHits * 5 + (unique.length - strongHits) * 2);
}

function locationScore(job: NormalizedJob, prefs: PreferenceInput, reasons: string[]): number {
  const city = (job as NormalizedJob & { city?: string }).city ?? "";
  const india = isIndiaLocation(city, job.country, job.remoteType);
  const hay = `${job.location} ${job.country} ${job.remoteType} ${city}`.toLowerCase();
  const targets = prefs.targetLocations.length ? prefs.targetLocations : PREFERRED_LOCATIONS;

  let points = -8;
  if (india || includesAny(hay, targets.map((t) => t.toLowerCase()))) {
    const matched = targets.find((t) => hay.includes(t.toLowerCase()));
    reasons.push(matched || city || job.location || "India");
    points = 10;
  } else if (job.remoteType === "remote" && hay.includes("india")) {
    reasons.push("Remote India");
    points = 10;
  } else if (prefs.allowInternational) {
    if (job.remoteType === "remote") {
      reasons.push("Remote");
      points = 6;
    } else {
      if (job.location || job.country) reasons.push(job.location || job.country);
      points = 5;
    }
  }

  if (prefs.remotePreference === "remote") {
    if (job.remoteType === "remote") {
      reasons.push("Remote preferred");
      points += 4;
    } else if (job.remoteType === "onsite") {
      points -= 5;
    }
  } else if (prefs.remotePreference === "hybrid") {
    if (job.remoteType === "hybrid" || job.remoteType === "remote") {
      reasons.push("Hybrid/remote preferred");
      points += 3;
    }
  } else if (prefs.remotePreference === "onsite" && job.remoteType === "remote") {
    points -= 3;
  }

  return points;
}

function freshnessScore(postedAt: Date | undefined, reasons: string[]): number {
  const days = daysAgo(postedAt ?? null);
  if (days === null) {
    reasons.push("Posted date unavailable");
    return 3;
  }
  if (days <= 0) {
    reasons.push("Posted today");
    return 10;
  }
  if (days <= 3) {
    reasons.push(`Posted ${days} day${days === 1 ? "" : "s"} ago`);
    return 8;
  }
  if (days <= 7) {
    reasons.push(`Posted ${days} days ago`);
    return 6;
  }
  if (days <= 14) {
    reasons.push(`Posted ${days} days ago`);
    return 3;
  }
  reasons.push("Posted 15+ days ago");
  return 1;
}

export function scoreJob(job: NormalizedJob, prefs: PreferenceInput): ScoreResult {
  const reasons: string[] = [];
  const title = titleScore(job.title, prefs, reasons);

  if (title === 0 && reasons.some((r) => r.startsWith("Not a target"))) {
    return { score: 0, reasons: [...new Set(reasons)].slice(0, 8), isRelevant: false };
  }

  const experience = experienceScore(job, prefs, reasons);
  const skills = skillScore(job, prefs, reasons);
  const location = locationScore(job, prefs, reasons);
  const freshness = freshnessScore(job.postedAt, reasons);

  // Low-title roles need strong skill overlap to stay relevant
  const lowTitle = LOW_TITLE_PATTERNS.some((p) => p.pattern.test(job.title));
  const adjustedSkills = lowTitle && skills < 12 ? Math.min(skills, 6) : skills;

  const raw = title + experience + adjustedSkills + location + freshness;
  const score = Math.max(0, Math.min(100, raw));
  const isRelevant = score >= prefs.minimumRelevanceScore && title > 0;

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 8),
    isRelevant,
  };
}

/** Whether a job should appear in the default feed when international is off. */
export function passesInternationalFilter(
  job: { city?: string; country?: string; location?: string; remoteType?: string },
  allowInternational: boolean
): boolean {
  if (allowInternational) return true;
  return isIndiaLocation(job.city ?? "", job.country ?? "", job.remoteType, job.location);
}
