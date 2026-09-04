import { fetchOfficialJobs } from "./official-pipeline";
import type { AdapterResult, CompanySource, JobSourceAdapter } from "./types";

export class GenericCareerPageAdapter implements JobSourceAdapter {
  type = "generic" as const;

  fetchJobs(company: CompanySource): Promise<AdapterResult> {
    return fetchOfficialJobs(company);
  }
}
