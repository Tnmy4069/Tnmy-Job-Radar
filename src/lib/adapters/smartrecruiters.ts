import { fetchJson } from "@/lib/http";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type SmartJob = {
  id: string;
  name: string;
  releasedDate?: string;
  applyUrl?: string;
  postingUrl?: string;
  location?: { city?: string; country?: string; remote?: boolean };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
};

type SmartResponse = {
  content?: SmartJob[];
  totalFound?: number;
};

export class SmartRecruitersAdapter implements JobSourceAdapter {
  type = "smartrecruiters" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const id = String(company.sourceConfig.companyId ?? company.name);
    const jobs: NormalizedJob[] = [];
    let offset = 0;
    const limit = 100;

    while (offset < 400) {
      const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(id)}/postings?offset=${offset}&limit=${limit}`;
      const data = await fetchJson<SmartResponse>(url);
      const batch = data.content ?? [];
      jobs.push(...batch.map((job) => this.normalize(job)));
      if (batch.length < limit) break;
      offset += limit;
    }

    return { jobs };
  }

  private normalize(job: SmartJob): NormalizedJob {
    const location = [job.location?.city, job.location?.country].filter(Boolean).join(", ");
    const url = job.postingUrl || job.applyUrl || "";
    return completeJob({
      externalId: job.id,
      title: job.name,
      location,
      country: job.location?.country ?? "",
      department: job.department?.label ?? "",
      employmentType: job.typeOfEmployment?.label ?? "",
      remoteType: job.location?.remote ? "remote" : undefined,
      applicationUrl: url,
      sourceUrl: url,
      sourceType: this.type,
      postedAt: parseRelativeDate(job.releasedDate),
    });
  }
}
