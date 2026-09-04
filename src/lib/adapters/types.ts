import type { BlockReason } from "@/lib/discovery/blocks";
import type { ExtractionMethod } from "@/lib/discovery/quality";

export type SourceType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "workday"
  | "amazon"
  | "google"
  | "microsoft"
  | "atlassian"
  | "generic";

export type RemoteType = "remote" | "hybrid" | "onsite" | "unknown";

export type CompanySource = {
  id: string;
  name: string;
  slug: string;
  careersUrl: string;
  sourceType: SourceType | string;
  sourceConfig: Record<string, unknown>;
};

export type NormalizedJob = {
  externalId?: string;
  title: string;
  description: string;
  location: string;
  country: string;
  employmentType: string;
  experienceLevel: string;
  department: string;
  team: string;
  skills: string[];
  salary?: string;
  remoteType: RemoteType;
  applicationUrl: string;
  sourceUrl: string;
  sourceType: string;
  postedAt?: Date;
  extractionConfidence?: number;
};

export type AdapterDiagnostics = {
  fetched: number;
  parsed: number;
  valid: number;
  rejected: number;
  duplicates: number;
};

export type AdapterResult = {
  jobs: NormalizedJob[];
  unsupported?: boolean;
  warning?: string;
  blockReason?: BlockReason;
  detectedSourceType?: string;
  detectedSourceConfig?: Record<string, unknown>;
  extractionMethod?: ExtractionMethod;
  diagnostics?: AdapterDiagnostics;
  jsShell?: boolean;
};

export interface JobSourceAdapter {
  type: SourceType;
  fetchJobs(company: CompanySource): Promise<AdapterResult>;
}

export class UnsupportedSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSourceError";
  }
}

export type SourceConfig = {
  boardToken?: string;
  tenant?: string;
  site?: string;
  companyId?: string;
  queries?: string[];
  countries?: string[];
  locationHints?: string[];
  extra?: Record<string, unknown>;
};

