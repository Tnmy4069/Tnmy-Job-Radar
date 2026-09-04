import { parseJobDate } from "@/lib/discovery/dates";
import { fetchText } from "@/lib/http";
import { completeJob } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

function decodeJsString(value: string): string {
  return value
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/");
}

function extractCallbackData(html: string, key: string): string | null {
  const marker = `key: '${key}'`;
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const dataIdx = html.indexOf("data:", start);
  if (dataIdx < 0) return null;
  return html.slice(dataIdx, dataIdx + 400_000);
}

export class GoogleAdapter implements JobSourceAdapter {
  type = "google" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const queries = (company.sourceConfig.queries as string[] | undefined) ?? ["Software Engineer"];
    const locations = (company.sourceConfig.locationHints as string[] | undefined) ?? ["India", ""];
    const seen = new Map<string, NormalizedJob>();

    for (const query of queries) {
      for (const location of locations) {
        const params = new URLSearchParams({ q: query });
        if (location) params.set("location", location);
        const url = `https://www.google.com/about/careers/applications/jobs/results/?${params.toString()}`;
        const html = await fetchText(url, {
          headers: {
            Accept: "text/html",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        });
        for (const job of this.parseJobs(html, url)) {
          seen.set(job.applicationUrl, job);
        }
      }
    }

    if (seen.size === 0) {
      return {
        jobs: [],
        unsupported: true,
        warning: "Google careers page did not expose parseable job listings",
      };
    }

    return { jobs: [...seen.values()] };
  }

  private parseJobs(html: string, sourceUrl: string): NormalizedJob[] {
    const chunk = extractCallbackData(html, "ds:1") ?? html;
    const jobs: NormalizedJob[] = [];
    const pattern =
      /\["(\d{8,})","([^"]{4,220})","(https:\\?\/\\?\/www\.google\.com\/about\/careers\/[^"]+)"/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(chunk))) {
      const [, id, title, rawUrl] = match;
      const applicationUrl = decodeJsString(rawUrl);
      const window = chunk.slice(match.index, match.index + 2500);
      const locationMatch =
        window.match(/"([A-Z][A-Za-z .'-]+,\s*(?:[A-Z][A-Za-z .'-]+,\s*)?(?:India|United States|United Kingdom|Canada|Germany|Singapore|Ireland|Switzerland|Japan|Australia))"/) ||
        window.match(/"(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Gurugram|Gurgaon|Noida|Chennai|Delhi|Sunnyvale|Mountain View|Seattle|New York|London|Zurich|Dublin|Singapore)[^"]{0,60}"/);
      const descMatch = window.match(/"(<ul[\s\S]{20,1200}<\/ul>)"/);
      const dateMatch =
        window.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/) ||
        window.match(/Posted (today|yesterday|\d+ days ago|[A-Z][a-z]+ \d{1,2}, \d{4})/i);
      jobs.push(
        completeJob({
          externalId: id,
          title: decodeJsString(title),
          description: descMatch ? decodeJsString(descMatch[1]) : "",
          location: locationMatch ? decodeJsString(locationMatch[1]) : "",
          applicationUrl,
          sourceUrl,
          sourceType: this.type,
          postedAt: parseJobDate(dateMatch?.[1] ? decodeJsString(dateMatch[1]) : null) ?? undefined,
        })
      );
    }

    return jobs;
  }
}
