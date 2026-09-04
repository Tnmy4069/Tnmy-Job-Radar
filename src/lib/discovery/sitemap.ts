import { originOf } from "./urls";

export function parseSitemapXml(xml: string): string[] {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) =>
    decodeXml(match[1].trim())
  );
  return [...new Set(locs)];
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function isJobLikeSitemapUrl(url: string): boolean {
  const hay = url.toLowerCase();
  return /\/(job|jobs|career|careers|position|posting|requisition|opening)s?(\/|$|\?)/.test(hay);
}

export function sitemapCandidatesFromRobots(sitemaps: string[], careersUrl: string): string[] {
  const origin = originOf(careersUrl);
  const extra = origin ? [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`] : [];
  return [...new Set([...sitemaps, ...extra])];
}

export function filterOfficialJobUrls(urls: string[], careersUrl: string): string[] {
  let host = "";
  try {
    host = new URL(careersUrl).hostname.replace(/^www\./, "");
  } catch {
    return [];
  }
  return urls.filter((url) => {
    try {
      const parsed = new URL(url);
      const candidate = parsed.hostname.replace(/^www\./, "");
      if (candidate !== host && !candidate.endsWith(`.${host}`)) return false;
      return isJobLikeSitemapUrl(url);
    } catch {
      return false;
    }
  });
}
