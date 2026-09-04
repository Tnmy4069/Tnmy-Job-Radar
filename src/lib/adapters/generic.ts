import { fetchText } from "@/lib/http";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type JsonLdJob = {
  title?: string;
  name?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressCountry?: string } } | Array<{
    address?: { addressLocality?: string; addressCountry?: string };
  }>;
  url?: string;
};

export class GenericCareerPageAdapter implements JobSourceAdapter {
  type = "generic" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const html = await fetchText(company.careersUrl, {
      headers: { Accept: "text/html" },
    });

    const jobs = [
      ...this.fromJsonLd(html, company),
      ...this.fromNextData(html, company),
    ];

    const unique = new Map(jobs.map((job) => [job.applicationUrl + job.title, job]));
    if (unique.size === 0) {
      return {
        jobs: [],
        unsupported: true,
        warning: "No official JSON-LD or embedded job feed found on the careers page",
      };
    }

    return { jobs: [...unique.values()] };
  }

  private fromJsonLd(html: string, company: CompanySource): NormalizedJob[] {
    const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    const jobs: NormalizedJob[] = [];

    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block[1]) as unknown;
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        for (const node of nodes) {
          const items = this.flatten(node);
          for (const item of items) {
            if (item["@type"] !== "JobPosting" && item.type !== "JobPosting") continue;
            const loc = Array.isArray(item.jobLocation) ? item.jobLocation[0] : item.jobLocation;
            jobs.push(
              completeJob({
                title: String(item.title || item.name || "Untitled"),
                description: String(item.description ?? ""),
                location: loc?.address?.addressLocality ?? "",
                country: loc?.address?.addressCountry ?? "",
                employmentType: String(item.employmentType ?? ""),
                applicationUrl: String(item.url || company.careersUrl),
                sourceUrl: company.careersUrl,
                sourceType: this.type,
                postedAt: parseRelativeDate(item.datePosted),
              })
            );
          }
        }
      } catch {
        // ignore malformed JSON-LD
      }
    }

    return jobs;
  }

  private fromNextData(html: string, company: CompanySource): NormalizedJob[] {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
    if (!match) return [];
    try {
      const data = JSON.parse(match[1]) as unknown;
      const bag: NormalizedJob[] = [];
      const walk = (value: unknown) => {
        if (!value) return;
        if (Array.isArray(value)) return value.forEach(walk);
        if (typeof value === "object") {
          const rec = value as Record<string, unknown>;
          if (typeof rec.title === "string" && (rec.url || rec.applyUrl || rec.hostedUrl)) {
            bag.push(
              completeJob({
                title: rec.title,
                description: String(rec.description ?? rec.content ?? ""),
                location: String(rec.location ?? rec.city ?? ""),
                applicationUrl: String(rec.applyUrl || rec.hostedUrl || rec.url),
                sourceUrl: company.careersUrl,
                sourceType: this.type,
              })
            );
          }
          Object.values(rec).forEach(walk);
        }
      };
      walk(data);
      return bag;
    } catch {
      return [];
    }
  }

  private flatten(node: unknown): Array<JsonLdJob & { "@type"?: string; type?: string }> {
    if (!node || typeof node !== "object") return [];
    const rec = node as Record<string, unknown>;
    const graph = rec["@graph"];
    if (Array.isArray(graph)) return graph as Array<JsonLdJob & { "@type"?: string }>;
    return [rec as JsonLdJob & { "@type"?: string }];
  }
}
