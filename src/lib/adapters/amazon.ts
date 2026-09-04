import { fetchJson } from "@/lib/http";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type AmazonJob = {
  id?: string;
  id_icims?: string;
  title: string;
  job_path?: string;
  city?: string;
  location?: string;
  country_code?: string;
  description?: string;
  basic_qualifications?: string;
  preferred_qualifications?: string;
  posted_date?: string;
  normalized_location?: string;
  job_category?: string;
  company_name?: string;
};

type AmazonResponse = {
  jobs?: AmazonJob[];
  hits?: number;
};

export class AmazonAdapter implements JobSourceAdapter {
  type = "amazon" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const queries = (company.sourceConfig.queries as string[] | undefined) ?? ["software engineer"];
    const countries = (company.sourceConfig.countries as string[] | undefined) ?? ["IND"];
    const seen = new Map<string, NormalizedJob>();

    for (const country of countries) {
      for (const query of queries) {
        let offset = 0;
        const limit = 50;
        while (offset < 150) {
          const params = new URLSearchParams({
            base_query: query,
            offset: String(offset),
            result_limit: String(limit),
            sort: "recent",
            country,
          });
          const data = await fetchJson<AmazonResponse>(
            `https://www.amazon.jobs/en/search.json?${params.toString()}`
          );
          const batch = data.jobs ?? [];
          for (const job of batch) {
            const normalized = this.normalize(job);
            seen.set(normalized.applicationUrl, normalized);
          }
          if (batch.length < limit) break;
          offset += limit;
        }
      }
    }

    return { jobs: [...seen.values()] };
  }

  private normalize(job: AmazonJob): NormalizedJob {
    const path = job.job_path || `/en/jobs/${job.id ?? job.id_icims ?? ""}`;
    const url = path.startsWith("http") ? path : `https://www.amazon.jobs${path}`;
    const description = [job.description, job.basic_qualifications, job.preferred_qualifications]
      .filter(Boolean)
      .join("\n\n");
    return completeJob({
      externalId: String(job.id ?? job.id_icims ?? url),
      title: job.title,
      description,
      location: job.normalized_location || job.location || job.city || "",
      country: job.country_code === "IND" ? "India" : job.country_code ?? "",
      department: job.job_category ?? "",
      applicationUrl: url,
      sourceUrl: url,
      sourceType: this.type,
      postedAt: parseRelativeDate(job.posted_date),
    });
  }
}
