const NAV =
  /^(home|careers|jobs|about|contact|privacy|terms|login|sign in|search|filter|next|previous|cookie)$/i;

export type HtmlLinkJob = {
  title: string;
  applicationUrl: string;
};

export function extractHtmlJobLinks(html: string, baseUrl: string): HtmlLinkJob[] {
  const jobs: HtmlLinkJob[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const href = match[1];
    const title = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (title.length < 8 || title.length > 180 || NAV.test(title)) continue;
    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (!/\/(job|jobs|career|careers|position|opening|posting)s?\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    jobs.push({ title, applicationUrl: url });
  }
  return jobs;
}
