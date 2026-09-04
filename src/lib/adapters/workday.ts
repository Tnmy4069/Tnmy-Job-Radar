import { fetchJson } from "@/lib/http";
import { completeJob, parseRelativeDate } from "./normalize";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

type WorkdayPosting = {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
};

type WorkdayResponse = {
  total?: number;
  jobPostings?: WorkdayPosting[];
};

export class WorkdayAdapter implements JobSourceAdapter {
  type = "workday" as const;

  async fetchJobs(company: CompanySource): Promise<AdapterResult> {
    const tenant = String(company.sourceConfig.tenant ?? company.slug);
    const site = String(company.sourceConfig.site ?? "External");
    const host = String(company.sourceConfig.host ?? `${tenant}.wd5.myworkdayjobs.com`);
    const jobs: NormalizedJob[] = [];
    let offset = 0;
    const limit = 20;

    while (offset < 200) {
      const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
      const data = await fetchJson<WorkdayResponse>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appliedFacets: {},
          limit,
          offset,
          searchText: "software engineer",
        }),
      });
      const batch = data.jobPostings ?? [];
      for (const posting of batch) {
        const path = posting.externalPath.startsWith("http")
          ? posting.externalPath
          : `https://${host}/en-US/${site}${posting.externalPath}`;
        jobs.push(
          completeJob({
            externalId: posting.bulletFields?.[0],
            title: posting.title,
            location: posting.locationsText ?? "",
            applicationUrl: path,
            sourceUrl: path,
            sourceType: this.type,
            postedAt: parseRelativeDate(posting.postedOn),
          })
        );
      }
      if (batch.length < limit) break;
      offset += limit;
    }

    return { jobs };
  }
}
