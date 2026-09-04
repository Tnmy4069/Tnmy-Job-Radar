import { fetchJson } from "@/lib/http";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: { location?: string; team?: string; commitment?: string };
  descriptionPlain?: string;
  description?: string;
};

export class LeverAdapter implements JobSourceAdapter {
  type = "lever" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const token = String(company.sourceConfig.boardToken ?? company.slug);
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
    const jobs = await fetchJson<LeverJob[]>(url);
    return {
      jobs: (Array.isArray(jobs) ? jobs : []).map((job) => this.normalize(job)),
    };
  }

  private normalize(job: LeverJob): NormalizedJob {
    return completeJob({
      externalId: job.id,
      title: job.text,
      description: job.descriptionPlain || job.description || "",
      location: job.categories?.location ?? "",
      department: job.categories?.team ?? "",
      employmentType: job.categories?.commitment ?? "",
      applicationUrl: job.applyUrl || job.hostedUrl,
      sourceUrl: job.hostedUrl,
      sourceType: this.type,
      postedAt: job.createdAt ? new Date(job.createdAt) : parseRelativeDate(undefined),
    });
  }
}
