import { parseJsonArray } from "@/lib/utils";
import type { PreferenceInput } from "@/lib/relevance/engine";
import { SENIOR_KEYWORDS } from "@/lib/relevance/defaults";

const STOP_WORDS = new Set(["a", "an", "the", "in", "at", "for", "and", "or", "of", "to", "with", "on"]);

const TOKEN_ALIASES: Record<string, string[]> = {
  js: ["javascript"],
  ts: ["typescript"],
  node: ["node.js", "nodejs"],
  nodejs: ["node.js"],
  "next.js": ["nextjs"],
  nextjs: ["next.js"],
  reactjs: ["react"],
  postgres: ["postgresql"],
  k8s: ["kubernetes"],
  bengaluru: ["bangalore"],
  bangalore: ["bengaluru"],
  gurugram: ["gurgaon"],
  gurgaon: ["gurugram"],
  sde: ["software engineer", "software development engineer"],
  se: ["software engineer"],
  fe: ["frontend", "front end"],
  be: ["backend", "back end"],
  ml: ["machine learning"],
  ai: ["artificial intelligence", "machine learning"],
};

export type ParsedQuery = {
  raw: string;
  tokens: string[];
  expanded: string[];
};

export function parseSearchQuery(q: string): ParsedQuery {
  const raw = q.trim().toLowerCase();
  const phrases: string[] = [];
  const rest = raw.replace(/"([^"]+)"/g, (_, phrase: string) => {
    const cleaned = phrase.trim();
    if (cleaned) phrases.push(cleaned);
    return " ";
  });
  const tokens = [...phrases, ...rest.split(/[\s,]+/)]
    .map((token) => token.replace(/^[^a-z0-9+#./-]+|[^a-z0-9+#./-]+$/gi, "").trim())
    .filter((token) => token.length >= 1 && !STOP_WORDS.has(token));
  const unique = [...new Set(tokens)];
  const expanded = new Set(unique);
  for (const token of unique) {
    for (const alias of TOKEN_ALIASES[token] ?? []) expanded.add(alias);
  }
  return { raw, tokens: unique, expanded: [...expanded] };
}

export function jobMatchesExcluded(
  title: string,
  prefs: Pick<PreferenceInput, "excludedKeywords" | "includeSeniorRoles">
): boolean {
  const excluded = prefs.excludedKeywords.map((item) => item.toLowerCase()).filter(Boolean);
  if (!excluded.length) return false;
  const hay = title.toLowerCase();
  const senior = new Set(SENIOR_KEYWORDS.map((item) => item.trim().toLowerCase()));
  for (const keyword of excluded) {
    if (prefs.includeSeniorRoles && senior.has(keyword)) continue;
    if (keyword.length <= 2) continue;
    if (hay.includes(keyword.toLowerCase())) return true;
  }
  return false;
}

type RankableJob = {
  title: string;
  searchText?: string;
  description?: string;
  location?: string;
  city?: string;
  country?: string;
  skills: string | string[];
  remoteType?: string;
  relevanceScore: number;
  company: { name: string };
};

export function rankSearchJob(job: RankableJob, parsed: ParsedQuery, prefs: PreferenceInput): number {
  if (!parsed.tokens.length) return job.relevanceScore;

  const title = job.title.toLowerCase();
  const company = job.company.name.toLowerCase();
  const city = (job.city || "").toLowerCase();
  const location = (job.location || "").toLowerCase();
  const country = (job.country || "").toLowerCase();
  const hay = (job.searchText || `${job.title} ${job.description || ""}`).toLowerCase();
  const skills = (Array.isArray(job.skills) ? job.skills : parseJsonArray(job.skills)).map((item) =>
    item.toLowerCase()
  );

  let score = 0;
  let hits = 0;

  for (const token of parsed.tokens) {
    const variants = [token, ...(TOKEN_ALIASES[token] ?? [])];
    const matched = variants.some((item) => {
      if (title.includes(item)) {
        score += item.length > 12 || item.includes(" ") ? 56 : 48;
        return true;
      }
      if (skills.some((skill) => skill.includes(item) || item.includes(skill))) {
        score += 30;
        return true;
      }
      if (company.includes(item)) {
        score += 24;
        return true;
      }
      if (city.includes(item) || location.includes(item) || country.includes(item)) {
        score += 20;
        return true;
      }
      if (hay.includes(item)) {
        score += 8;
        return true;
      }
      return false;
    });
    if (matched) hits += 1;
  }

  if (parsed.tokens.length && hits === parsed.tokens.length) score += 36;
  else if (hits > 0) score += hits * 6;

  const titleTargets = prefs.targetTitles.map((item) => item.toLowerCase());
  if (titleTargets.some((item) => title.includes(item))) score += 10;

  const skillTargets = prefs.targetSkills.map((item) => item.toLowerCase());
  if (skillTargets.some((item) => skills.some((skill) => skill.includes(item) || item.includes(skill)))) {
    score += 8;
  }

  const locationTargets = prefs.targetLocations.map((item) => item.toLowerCase());
  if (locationTargets.some((item) => city.includes(item) || location.includes(item) || country.includes(item))) {
    score += 6;
  }

  if (prefs.remotePreference === "remote" && job.remoteType === "remote") score += 4;

  return score + job.relevanceScore * 0.35;
}
