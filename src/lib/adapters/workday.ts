import { maxPagesPerSource } from "@/lib/discovery/config";
import { extractionConfidence } from "@/lib/discovery/quality";
import { rememberIds, shouldStopPagination } from "@/lib/discovery/pagination";
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
    const seenIds = new Set<string>();
    let offset = 0;
    const limit = 20;
    let page = 1;

    while (page <= maxPagesPerSource()) {
      const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
      const data = await fetchJson<WorkdayResponse>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appliedFacets: {},
          limit,
          offset,
          searchText: "",
        }),
      });
      const batch = data.jobPostings ?? [];
      const batchIds: string[] = [];
      for (const posting of batch) {
        const id = posting.bulletFields?.[0] || posting.externalPath;
        batchIds.push(id);
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
            extractionConfidence: extractionConfidence("api"),
          })
        );
      }
      if (
        shouldStopPagination({
          page,
          batchIds,
          seenIds,
          batchSize: batch.length,
          pageSize: limit,
        })
      ) {
        break;
      }
      rememberIds({ page, seenIds }, batchIds);
      offset += limit;
      page += 1;
    }

    return { jobs, extractionMethod: "api" };
  }
}
