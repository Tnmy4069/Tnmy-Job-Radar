const TRACKING_PARAM = /^(utm_|mc_|_ga|_gl|hsa_|pk_|piwik_|mtm_)/i;
const TRACKING_EXACT = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "ref",
  "referrer",
  "ref_src",
  "ocid",
  "icid",
]);

export function normalizeApplicationUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    const drop: string[] = [];
    url.searchParams.forEach((_value, key) => {
      if (TRACKING_EXACT.has(key.toLowerCase()) || TRACKING_PARAM.test(key)) {
        drop.push(key);
      }
    });
    for (const key of drop) url.searchParams.delete(key);
    let href = url.toString();
    if (url.pathname.length > 1 && href.endsWith("/")) href = href.slice(0, -1);
    if (!url.search && href.endsWith("?")) href = href.slice(0, -1);
    return href;
  } catch {
    return trimmed.replace(/#.*$/, "").replace(/\/+$/, "");
  }
}

const AGGREGATOR_HOST =
  /indeed\.|linkedin\.com$|jobs\.linkedin\.|glassdoor\.|naukri\.|ziprecruiter\.|jooble\.|wellfound\.|ambitionbox\.|timesjobs\./i;

export function isOfficialApplicationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "linkedin.com" && parsed.pathname.startsWith("/jobs")) return false;
    return !AGGREGATOR_HOST.test(host) && !AGGREGATOR_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function sameOfficialHost(candidate: string, official: string): boolean {
  try {
    const a = new URL(candidate);
    const b = new URL(official);
    return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
