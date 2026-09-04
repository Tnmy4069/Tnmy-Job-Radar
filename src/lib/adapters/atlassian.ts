import { maxPagesPerSource } from "@/lib/discovery/config";
import { extractEmbeddedJsonJobs } from "@/lib/discovery/embedded";
import { fetchJson, fetchText } from "@/lib/http";
import { extractedToNormalized } from "./base";
import { completeJob } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type LooseJob = {
  title?: string;
  name?: string;
  location?: string;
  locations?: string[];
  city?: string;
  url?: string;
  applyUrl?: string;
  absolute_url?: string;
  department?: string;
  team?: string;
  description?: string;
  id?: string | number;
};

export class AtlassianAdapter implements JobSourceAdapter {
  type = "atlassian" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const errors: string[] = [];

    const endpoints = [
      "https://www.atlassian.com/company/careers/all-jobs/api",
      "https://www.atlassian.com/company/careers/api/jobs",
    ];

    for (const url of endpoints) {
      try {
        const data = await fetchJson<unknown>(url);
        const jobs = this.collect(data, url);
        if (jobs.length) return { jobs };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    try {
      const html = await fetchText(company.careersUrl, {
        headers: { Accept: "text/html" },
      });
      const embedded = extractEmbeddedJsonJobs(html, company.careersUrl).map((job) =>
        extractedToNormalized(job, company, job.source === "jsonld" ? "jsonld" : "json")
      );
      if (embedded.length) return { jobs: embedded, extractionMethod: "json" };
      const jobs = this.fromHtml(html, company.careersUrl);
      if (jobs.length) return { jobs, extractionMethod: "html" };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    try {
      const jobs: NormalizedJob[] = [];
      const limit = 50;
      let offset = 0;
      let page = 1;
      while (page <= maxPagesPerSource()) {
        const data = await fetchJson<{ jobPostings?: { title: string; externalPath: string; locationsText?: string }[] }>(
          "https://atlassian.wd5.myworkdayjobs.com/wday/cxs/atlassian/atlassian/jobs",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: "" }),
          }
        );
        const batch = data.jobPostings ?? [];
        for (const job of batch) {
          jobs.push(
            completeJob({
              title: job.title,
              location: job.locationsText ?? "",
              applicationUrl: `https://www.atlassian.com/company/careers/details/${job.externalPath.split("/").pop() ?? ""}`,
              sourceUrl: company.careersUrl,
              sourceType: this.type,
            })
          );
        }
        if (batch.length < limit) break;
        offset += limit;
        page += 1;
      }
      if (jobs.length) return { jobs, extractionMethod: "api" };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      jobs: [],
      unsupported: true,
      warning: `Atlassian official careers source is currently unavailable. ${errors.slice(0, 2).join(" | ")}`,
    };
  }

  private collect(data: unknown, sourceUrl: string): NormalizedJob[] {
    const bag: LooseJob[] = [];
    const walk = (value: unknown) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === "object") {
        const rec = value as Record<string, unknown>;
        if (typeof rec.title === "string" && (rec.url || rec.applyUrl || rec.absolute_url || rec.id)) {
          bag.push(rec as LooseJob);
        }
        Object.values(rec).forEach(walk);
      }
    };
    walk(data);
    return bag.map((job) =>
      completeJob({
        externalId: job.id ? String(job.id) : undefined,
        title: job.title || job.name || "Untitled",
        description: job.description ?? "",
        location: job.location || job.locations?.[0] || job.city || "",
        department: job.department ?? "",
        team: job.team ?? "",
        applicationUrl: String(job.applyUrl || job.absolute_url || job.url || sourceUrl),
        sourceUrl,
        sourceType: this.type,
      })
    );
  }

  private fromHtml(html: string, sourceUrl: string): NormalizedJob[] {
    const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
    if (next?.[1]) {
      try {
        return this.collect(JSON.parse(next[1]), sourceUrl);
      } catch {
        // ignore
      }
    }
    const jobs: NormalizedJob[] = [];
    const card = /href="(https:\/\/www\.atlassian\.com\/company\/careers\/details\/[^"]+)"[^>]*>\s*([^<]{6,160})/g;
    let match: RegExpExecArray | null;
    while ((match = card.exec(html))) {
      jobs.push(
        completeJob({
          title: match[2].trim(),
          applicationUrl: match[1],
          sourceUrl,
          sourceType: this.type,
        })
      );
    }
    return jobs;
  }
}
