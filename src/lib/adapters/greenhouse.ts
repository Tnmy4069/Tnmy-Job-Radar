import { fetchJson } from "@/lib/http";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
  departments?: { name?: string }[];
  offices?: { name?: string; location?: string }[];
};

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
};

export class GreenhouseAdapter implements JobSourceAdapter {
  type = "greenhouse" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const token = String(company.sourceConfig.boardToken ?? company.slug);
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
    const data = await fetchJson<GreenhouseResponse>(url);
    const jobs = (data.jobs ?? []).map((job) => this.normalize(company, job));
    return { jobs };
  }

  private normalize(company: CompanySource, job: GreenhouseJob): NormalizedJob {
    const location = job.location?.name || job.offices?.[0]?.location || job.offices?.[0]?.name || "";
    return completeJob({
      externalId: String(job.id),
      title: job.title,
      description: job.content ?? "",
      location,
      department: job.departments?.[0]?.name ?? "",
      applicationUrl: job.absolute_url,
      sourceUrl: job.absolute_url,
      sourceType: this.type,
      postedAt: parseRelativeDate(job.updated_at),
    });
  }
}
