import { fetchJson } from "@/lib/http";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type AshbyJob = {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
};

type AshbyResponse = {
  jobs?: AshbyJob[];
};

export class AshbyAdapter implements JobSourceAdapter {
  type = "ashby" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const token = String(company.sourceConfig.boardToken ?? company.slug);
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`;
    const data = await fetchJson<AshbyResponse>(url);
    return { jobs: (data.jobs ?? []).map((job) => this.normalize(company, job)) };
  }

  private normalize(company: CompanySource, job: AshbyJob): NormalizedJob {
    const apply = job.applyUrl || job.jobUrl || `${company.careersUrl}?ashby_jid=${job.id}`;
    return completeJob({
      externalId: job.id,
      title: job.title,
      description: job.descriptionHtml || job.descriptionPlain || "",
      location: job.location ?? "",
      department: job.department ?? "",
      team: job.team ?? "",
      employmentType: job.employmentType ?? "",
      remoteType: job.isRemote || job.workplaceType?.toLowerCase() === "remote" ? "remote" : undefined,
      applicationUrl: apply,
      sourceUrl: apply,
      sourceType: this.type,
      postedAt: parseRelativeDate(job.publishedAt),
    });
  }
}
