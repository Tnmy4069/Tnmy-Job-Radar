import { AmazonAdapter } from "./amazon";
import { AshbyAdapter } from "./ashby";
import { AtlassianAdapter } from "./atlassian";
import { GenericCareerPageAdapter } from "./generic";
import { GoogleAdapter } from "./google";
import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { MicrosoftAdapter } from "./microsoft";
import { SmartRecruitersAdapter } from "./smartrecruiters";
import { WorkdayAdapter } from "./workday";
import type { CompanySource, JobSourceAdapter, SourceType } from "./types";

const adapters: Record<SourceType, JobSourceAdapter> = {
  greenhouse: new GreenhouseAdapter(),
  lever: new LeverAdapter(),
  ashby: new AshbyAdapter(),
  smartrecruiters: new SmartRecruitersAdapter(),
  workday: new WorkdayAdapter(),
  amazon: new AmazonAdapter(),
  google: new GoogleAdapter(),
  microsoft: new MicrosoftAdapter(),
  atlassian: new AtlassianAdapter(),
  generic: new GenericCareerPageAdapter(),
};

export function getAdapter(sourceType: string): JobSourceAdapter {
  return adapters[(sourceType as SourceType) ?? "generic"] ?? adapters.generic;
}

export function toCompanySource(company: {
  id: string;
  name: string;
  slug: string;
  careersUrl: string;
  sourceType: string;
  sourceConfig: string;
}): CompanySource {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(company.sourceConfig || "{}") as Record<string, unknown>;
  } catch {
    config = {};
  }
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    careersUrl: company.careersUrl,
    sourceType: company.sourceType,
    sourceConfig: config,
  };
}

export function listAdapterTypes(): SourceType[] {
  return Object.keys(adapters) as SourceType[];
}
