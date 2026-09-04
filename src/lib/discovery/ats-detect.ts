import type { SourceType } from "@/lib/adapters/types";

export type DetectedAts = {
  type: Exclude<SourceType, "generic" | "amazon" | "google" | "microsoft" | "atlassian">;
  config: Record<string, unknown>;
  confidence: number;
};

function tokenFromPath(url: string, index: number): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[index] ?? null;
  } catch {
    return null;
  }
}

function high(type: DetectedAts["type"], config: Record<string, unknown>, confidence = 96): DetectedAts {
  return { type, config, confidence };
}

function hostHints(pageUrl: string): string[] {
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, "").toLowerCase();
    const base = host.split(".")[0] ?? "";
    const hints = new Set<string>([base, host.replace(/\./g, "")]);
    if (base.endsWith("inc")) hints.add(base.replace(/inc$/, ""));
    if (base.endsWith("hq")) hints.add(base.replace(/hq$/, ""));
    return [...hints].filter((hint) => hint.length >= 3);
  } catch {
    return [];
  }
}

function tokenRelated(token: string, hints: string[]): boolean {
  const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  return hints.some(
    (hint) =>
      normalized === hint ||
      normalized.includes(hint) ||
      hint.includes(normalized) ||
      // common aliases
      (hint === "wandb" && normalized.includes("weights")) ||
      (hint === "getdbt" && normalized.includes("dbt")) ||
      (hint === "sentry" && normalized === "getsentry") ||
      (hint === "block" && (normalized === "square" || normalized === "block"))
  );
}

export function detectAtsFromUrl(url: string): DetectedAts | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();

  if (host.endsWith("greenhouse.io")) {
    const forToken = parsed.searchParams.get("for");
    if (forToken) return high("greenhouse", { boardToken: forToken }, 97);
    if (host === "boards-api.greenhouse.io") {
      const token = tokenFromPath(url, 2);
      if (token) return high("greenhouse", { boardToken: token }, 98);
    }
    if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") {
      const token = tokenFromPath(url, 0);
      if (token && token !== "embed") return high("greenhouse", { boardToken: token });
    }
  }

  if (host === "jobs.lever.co") {
    const token = tokenFromPath(url, 0);
    if (token) return high("lever", { boardToken: token });
  }

  if (host === "jobs.ashbyhq.com") {
    const token = tokenFromPath(url, 0);
    if (token) return high("ashby", { boardToken: token });
  }
  if (host === "api.ashbyhq.com") {
    const token = url.match(/job-board\/([^/?#]+)/i)?.[1];
    if (token) return high("ashby", { boardToken: token }, 98);
  }

  if (/\.wd\d\.myworkdayjobs\.com$/i.test(host) || host.endsWith(".myworkdayjobs.com")) {
    const tenant = host.split(".")[0];
    const site = tokenFromPath(url, 0) || "External";
    if (tenant && tenant !== "www") {
      return high("workday", { tenant, site, host }, 95);
    }
  }

  if (host === "jobs.smartrecruiters.com" || host === "api.smartrecruiters.com") {
    const id =
      host === "api.smartrecruiters.com" ? url.match(/companies\/([^/?#]+)/i)?.[1] : tokenFromPath(url, 0);
    if (id) return high("smartrecruiters", { companyId: id }, 95);
  }

  return null;
}

type Candidate = DetectedAts & { token: string };

function collectHtmlCandidates(html: string): Candidate[] {
  const out: Candidate[] = [];
  const push = (type: DetectedAts["type"], token: string, config: Record<string, unknown>, confidence = 94) => {
    if (!token || token === "embed") return;
    out.push({ type, token, config, confidence });
  };

  for (const match of html.matchAll(/greenhouse\.io\/embed\/job_board\?for=([^"'&]+)/gi)) {
    push("greenhouse", match[1], { boardToken: match[1] });
  }
  for (const match of html.matchAll(/(?:job-boards|boards)\.greenhouse\.io\/([^"'/?\s]+)/gi)) {
    push("greenhouse", match[1], { boardToken: match[1] });
  }
  for (const match of html.matchAll(/jobs\.lever\.co\/([^"'/?\s]+)/gi)) {
    push("lever", match[1], { boardToken: match[1] });
  }
  for (const match of html.matchAll(/jobs\.ashbyhq\.com\/([^"'/?\s]+)/gi)) {
    push("ashby", match[1], { boardToken: match[1] });
  }
  for (const match of html.matchAll(/api\.ashbyhq\.com\/posting-api\/job-board\/([^"'/?\s]+)/gi)) {
    push("ashby", match[1], { boardToken: match[1] }, 95);
  }
  for (const match of html.matchAll(/https?:\/\/([a-z0-9-]+\.wd\d\.myworkdayjobs\.com)\/([^"'/?\s]+)/gi)) {
    out.push({
      type: "workday",
      token: match[1].split(".")[0],
      config: { host: match[1], tenant: match[1].split(".")[0], site: match[2] },
      confidence: 94,
    });
  }
  for (const match of html.matchAll(/jobs\.smartrecruiters\.com\/([^"'/?\s]+)/gi)) {
    push("smartrecruiters", match[1], { companyId: match[1] });
  }
  return out;
}

export function detectAtsFromHtml(html: string, pageUrl: string): DetectedAts | null {
  const fromUrl = detectAtsFromUrl(pageUrl);
  if (fromUrl) return fromUrl;

  const candidates = collectHtmlCandidates(html);
  if (!candidates.length) return null;

  const hints = hostHints(pageUrl);
  const related = candidates.filter((row) => tokenRelated(row.token, hints));
  const chosen = (related[0] ?? (candidates.length === 1 ? candidates[0] : null)) ?? null;
  if (!chosen) {
    // Multiple unrelated ATS mentions (blog embeds, partner jobs) — do not guess.
    return null;
  }
  return {
    type: chosen.type,
    config: chosen.config,
    confidence: related.length ? Math.min(96, chosen.confidence + 1) : Math.max(80, chosen.confidence - 8),
  };
}
