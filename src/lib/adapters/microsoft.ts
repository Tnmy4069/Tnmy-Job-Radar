import { extractEmbeddedJsonJobs } from "@/lib/discovery/embedded";
import { fetchJson, fetchText, HttpError } from "@/lib/http";
import { extractedToNormalized } from "./base";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type EightfoldJob = {
  id?: string | number;
  name?: string;
  title?: string;
  location?: string;
  locations?: string[];
  department?: string;
  job_description?: string;
  description?: string;
  published_at?: string;
  created_at?: string;
  apply_url?: string;
  url?: string;
  absolute_url?: string;
};

type EightfoldResponse = {
  positions?: EightfoldJob[];
  data?: EightfoldJob[];
  jobs?: EightfoldJob[];
};

export class MicrosoftAdapter implements JobSourceAdapter {
  type = "microsoft" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const queries = (company.sourceConfig.queries as string[] | undefined) ?? ["software engineer"];
    const seen = new Map<string, NormalizedJob>();
    const errors: string[] = [];

    for (const query of queries) {
      const attempts = [
        () => this.fromEightfold("https://apply.careers.microsoft.com/api/apply/v2/jobs", query),
        () => this.fromEightfold("https://jobs.careers.microsoft.com/api/apply/v2/jobs", query),
        () => this.fromGcs(query),
      ];

      for (const attempt of attempts) {
        try {
          const jobs = await attempt();
          for (const job of jobs) seen.set(job.applicationUrl, job);
          if (jobs.length) break;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (seen.size === 0) {
      try {
        const htmlJobs = await this.fromHtml();
        for (const job of htmlJobs) seen.set(job.applicationUrl, job);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (seen.size === 0) {
      return {
        jobs: [],
        unsupported: true,
        warning: `Microsoft official endpoints did not return jobs. ${errors.slice(0, 3).join(" | ")}`,
      };
    }

    return { jobs: [...seen.values()] };
  }

  private async fromEightfold(base: string, query: string): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({
      domain: "microsoft.com",
      start: "0",
      num: "50",
      query,
      location: "India",
    });
    const data = await fetchJson<EightfoldResponse>(`${base}?${params.toString()}`);
    const raw = data.positions ?? data.data ?? data.jobs ?? [];
    return raw.map((job) => this.normalize(job));
  }

  private async fromGcs(query: string): Promise<NormalizedJob[]> {
    const data = await fetchJson<{ operationResult?: { result?: { jobs?: EightfoldJob[] } } }>(
      "https://gcsservices.careers.microsoft.com/search/api/v1/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Keyword: query,
          Location: "India",
          PageSize: 50,
        }),
      }
    );
    const jobs = data.operationResult?.result?.jobs ?? [];
    return jobs.map((job) => this.normalize(job));
  }

  private async fromHtml(): Promise<NormalizedJob[]> {
    const html = await fetchText(
      "https://jobs.careers.microsoft.com/global/en/search?q=software%20engineer&l=en_us&pg=1&pgSz=20&o=Recent"
    );
    if (html.length < 200) throw new HttpError("Empty Microsoft careers HTML", 502, "microsoft-html");
    return extractEmbeddedJsonJobs(html, "https://jobs.careers.microsoft.com/global/en/search").map((job) =>
      extractedToNormalized(
        job,
        {
          id: "microsoft",
          name: "Microsoft",
          slug: "microsoft",
          careersUrl: "https://jobs.careers.microsoft.com/global/en/search",
          sourceType: this.type,
          sourceConfig: {},
        },
        job.source === "jsonld" ? "jsonld" : "json"
      )
    );
  }

  private normalize(job: EightfoldJob): NormalizedJob {
    const title = job.name || job.title || "Untitled";
    const url =
      job.apply_url ||
      job.absolute_url ||
      job.url ||
      (job.id
        ? `https://jobs.careers.microsoft.com/global/en/job/${job.id}/${encodeURIComponent(title)}`
        : "https://jobs.careers.microsoft.com/global/en/search");
    return completeJob({
      externalId: job.id ? String(job.id) : undefined,
      title,
      description: job.job_description || job.description || "",
      location: job.location || job.locations?.[0] || "",
      department: job.department ?? "",
      applicationUrl: url,
      sourceUrl: url,
      sourceType: this.type,
      postedAt: parseRelativeDate(job.published_at || job.created_at),
    });
  }
}
