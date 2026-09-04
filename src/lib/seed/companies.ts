import type { SourceType } from "@/lib/adapters/types";
import { ADDITIONAL_COMPANY_SEEDS } from "./companies-additional";

export type CompanyCategory =
  | "BIG_TECH"
  | "SAAS"
  | "DEVTOOLS"
  | "AI"
  | "CLOUD"
  | "FINTECH"
  | "CONSUMER_TECH"
  | "INDIAN_PRODUCT"
  | "OTHER_PRODUCT";

export type CompanySeed = {
  name: string;
  slug: string;
  careersUrl: string;
  sourceType: SourceType;
  sourceConfig?: Record<string, unknown>;
  tier: "tier-1" | "indian" | "saas" | "ai";
  enabled?: boolean;
  domain: string;
  category?: CompanyCategory;
  priority?: "A" | "B" | "C";
  indiaHiring?: "true" | "false" | "unknown";
  sourceStatus?: "VERIFIED" | "UNVERIFIED" | "UNSUPPORTED" | "FAILED" | "DISABLED";
  sourceNotes?: string;
};

/** Working official sources already in production. Do not overwrite their adapter config. */
export const PRESERVE_VERIFIED = new Set([
  "google",
  "amazon",
  "adobe",
  "stripe",
  "datadog",
  "cloudflare",
  "figma",
  "nvidia",
  "gitlab",
  "twilio",
  "notion",
  "dropbox",
  "okta",
  "elastic",
  "openai",
  "databricks",
  "glean",
]);

/** Confirmed unsupported by current adapters. Stay disabled. */
export const PRESERVE_UNSUPPORTED = new Set(["microsoft", "atlassian"]);

const TIER_CATEGORY: Record<CompanySeed["tier"], CompanyCategory> = {
  "tier-1": "BIG_TECH",
  indian: "INDIAN_PRODUCT",
  saas: "SAAS",
  ai: "AI",
};

export function enrichSeed(company: CompanySeed): Required<
  Pick<CompanySeed, "category" | "priority" | "indiaHiring" | "sourceStatus" | "enabled">
> &
  CompanySeed {
  const verified = PRESERVE_VERIFIED.has(company.slug);
  const unsupported = PRESERVE_UNSUPPORTED.has(company.slug);
  return {
    ...company,
    category: company.category ?? TIER_CATEGORY[company.tier],
    priority: company.priority ?? (company.tier === "tier-1" || verified ? "A" : company.tier === "indian" ? "B" : "B"),
    indiaHiring: company.indiaHiring ?? (company.tier === "indian" ? "true" : "unknown"),
    sourceStatus: company.sourceStatus ?? (verified ? "VERIFIED" : unsupported ? "UNSUPPORTED" : "UNVERIFIED"),
    enabled: verified ? true : false,
    sourceNotes:
      company.sourceNotes ??
      (unsupported ? "Official source previously unsupported by current adapters" : ""),
  };
}

function dedupeSeeds(seeds: CompanySeed[]): CompanySeed[] {
  const bySlug = new Map<string, CompanySeed>();
  const byDomain = new Map<string, string>();
  for (const seed of seeds) {
    if (bySlug.has(seed.slug)) continue;
    const domain = seed.domain.replace(/^www\./, "").toLowerCase();
    const existingSlug = byDomain.get(domain);
    if (existingSlug && existingSlug !== seed.slug) {
      // Related brands (Zomato/Eternal, Amazon/AWS) stay as explicit extra slugs only if already present.
      if (!PRESERVE_VERIFIED.has(seed.slug) && !COMPANY_SEEDS.some((row) => row.slug === seed.slug)) {
        continue;
      }
    }
    bySlug.set(seed.slug, enrichSeed(seed));
    if (!byDomain.has(domain)) byDomain.set(domain, seed.slug);
  }
  return [...bySlug.values()];
}

export const COMPANY_SEEDS: CompanySeed[] = [
  // First-wave official sources
  {
    name: "Google",
    slug: "google",
    careersUrl: "https://www.google.com/about/careers/applications/jobs/results/",
    sourceType: "google",
    sourceConfig: { queries: ["Software Engineer", "SDE", "Early Career"], locationHints: ["India"] },
    tier: "tier-1",
    domain: "google.com",
  },
  {
    name: "Microsoft",
    slug: "microsoft",
    careersUrl: "https://jobs.careers.microsoft.com/global/en/search",
    sourceType: "microsoft",
    sourceConfig: { queries: ["software engineer", "SDE"] },
    tier: "tier-1",
    domain: "microsoft.com",
  },
  {
    name: "Amazon",
    slug: "amazon",
    careersUrl: "https://www.amazon.jobs/en/",
    sourceType: "amazon",
    sourceConfig: { queries: ["software engineer", "SDE"], countries: ["IND"] },
    tier: "tier-1",
    domain: "amazon.jobs",
  },
  {
    name: "Adobe",
    slug: "adobe",
    careersUrl: "https://careers.adobe.com/",
    sourceType: "workday",
    sourceConfig: { tenant: "adobe", site: "external_experienced", host: "adobe.wd5.myworkdayjobs.com" },
    tier: "tier-1",
    domain: "adobe.com",
  },
  {
    name: "Atlassian",
    slug: "atlassian",
    careersUrl: "https://www.atlassian.com/company/careers/all-jobs",
    sourceType: "atlassian",
    sourceConfig: {},
    tier: "tier-1",
    domain: "atlassian.com",
  },

  // Remaining Tier 1
  {
    name: "Salesforce",
    slug: "salesforce",
    careersUrl: "https://careers.salesforce.com/en/jobs/",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "salesforce.com",
  },
  {
    name: "Apple",
    slug: "apple",
    careersUrl: "https://jobs.apple.com/en-us/search",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "apple.com",
  },
  {
    name: "Meta",
    slug: "meta",
    careersUrl: "https://www.metacareers.com/jobs",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "metacareers.com",
  },
  {
    name: "NVIDIA",
    slug: "nvidia",
    careersUrl: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",
    sourceType: "workday",
    sourceConfig: {
      tenant: "nvidia",
      site: "NVIDIAExternalCareerSite",
      host: "nvidia.wd5.myworkdayjobs.com",
    },
    tier: "tier-1",
    domain: "nvidia.com",
  },
  {
    name: "Uber",
    slug: "uber",
    careersUrl: "https://www.uber.com/careers/",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "uber.com",
  },
  {
    name: "LinkedIn",
    slug: "linkedin",
    careersUrl: "https://careers.linkedin.com/",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "linkedin.com",
  },
  {
    name: "Oracle",
    slug: "oracle",
    careersUrl: "https://careers.oracle.com/",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "oracle.com",
  },
  {
    name: "SAP",
    slug: "sap",
    careersUrl: "https://jobs.sap.com/",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "sap.com",
  },
  {
    name: "ServiceNow",
    slug: "servicenow",
    careersUrl: "https://careers.servicenow.com/",
    sourceType: "generic",
    tier: "tier-1",
    enabled: false,
    domain: "servicenow.com",
  },
  {
    name: "Stripe",
    slug: "stripe",
    careersUrl: "https://stripe.com/jobs",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "stripe" },
    tier: "tier-1",
    domain: "stripe.com",
  },

  // Indian product
  {
    name: "PhonePe",
    slug: "phonepe",
    careersUrl: "https://www.phonepe.com/careers/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "phonepe.com",
  },
  {
    name: "Razorpay",
    slug: "razorpay",
    careersUrl: "https://razorpay.com/jobs/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "razorpay.com",
  },
  {
    name: "Flipkart",
    slug: "flipkart",
    careersUrl: "https://www.flipkartcareers.com/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "flipkart.com",
  },
  {
    name: "Meesho",
    slug: "meesho",
    careersUrl: "https://careers.meesho.com/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "meesho.com",
  },
  {
    name: "CRED",
    slug: "cred",
    careersUrl: "https://careers.cred.club/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "cred.club",
  },
  {
    name: "Groww",
    slug: "groww",
    careersUrl: "https://groww.in/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "groww.in",
  },
  {
    name: "Swiggy",
    slug: "swiggy",
    careersUrl: "https://careers.swiggy.com/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "swiggy.com",
  },
  {
    name: "Zomato",
    slug: "zomato",
    careersUrl: "https://www.zomato.com/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "zomato.com",
  },
  {
    name: "Eternal",
    slug: "eternal",
    careersUrl: "https://www.eternal.com/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "eternal.com",
  },
  {
    name: "Zepto",
    slug: "zepto",
    careersUrl: "https://www.zeptonow.com/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "zeptonow.com",
  },
  {
    name: "Zerodha",
    slug: "zerodha",
    careersUrl: "https://careers.zerodha.com/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "zerodha.com",
  },
  {
    name: "Paytm",
    slug: "paytm",
    careersUrl: "https://paytm.com/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "paytm.com",
  },
  {
    name: "Myntra",
    slug: "myntra",
    careersUrl: "https://careers.myntra.com/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "myntra.com",
  },
  {
    name: "Dream11",
    slug: "dream11",
    careersUrl: "https://www.dream11.com/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "dream11.com",
  },
  {
    name: "Urban Company",
    slug: "urban-company",
    careersUrl: "https://careers.urbancompany.com/",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "urbancompany.com",
  },
  {
    name: "Delhivery",
    slug: "delhivery",
    careersUrl: "https://www.delhivery.com/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "delhivery.com",
  },
  {
    name: "ShareChat",
    slug: "sharechat",
    careersUrl: "https://sharechat.com/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "sharechat.com",
  },
  {
    name: "Juspay",
    slug: "juspay",
    careersUrl: "https://juspay.in/careers",
    sourceType: "generic",
    tier: "indian",
    enabled: false,
    domain: "juspay.in",
  },

  // SaaS / developer tools
  {
    name: "Postman",
    slug: "postman",
    careersUrl: "https://www.postman.com/company/careers/",
    sourceType: "generic",
    tier: "saas",
    enabled: false,
    domain: "postman.com",
  },
  {
    name: "BrowserStack",
    slug: "browserstack",
    careersUrl: "https://www.browserstack.com/careers",
    sourceType: "generic",
    tier: "saas",
    enabled: false,
    domain: "browserstack.com",
  },
  {
    name: "Freshworks",
    slug: "freshworks",
    careersUrl: "https://www.freshworks.com/company/careers/",
    sourceType: "generic",
    tier: "saas",
    enabled: false,
    domain: "freshworks.com",
  },
  {
    name: "Zoho",
    slug: "zoho",
    careersUrl: "https://careers.zohocorp.com/",
    sourceType: "generic",
    tier: "saas",
    enabled: false,
    domain: "zoho.com",
  },
  {
    name: "GitLab",
    slug: "gitlab",
    careersUrl: "https://about.gitlab.com/jobs/",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "gitlab" },
    tier: "saas",
    domain: "gitlab.com",
  },
  {
    name: "GitHub",
    slug: "github",
    careersUrl: "https://www.github.careers/",
    sourceType: "generic",
    tier: "saas",
    enabled: false,
    domain: "github.com",
  },
  {
    name: "HubSpot",
    slug: "hubspot",
    careersUrl: "https://www.hubspot.com/careers",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "hubspot" },
    tier: "saas",
    enabled: false,
    domain: "hubspot.com",
  },
  {
    name: "Twilio",
    slug: "twilio",
    careersUrl: "https://www.twilio.com/company/jobs",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "twilio" },
    tier: "saas",
    domain: "twilio.com",
  },
  {
    name: "Datadog",
    slug: "datadog",
    careersUrl: "https://careers.datadoghq.com/",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "datadog" },
    tier: "saas",
    domain: "datadoghq.com",
  },
  {
    name: "Cloudflare",
    slug: "cloudflare",
    careersUrl: "https://www.cloudflare.com/careers/",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "cloudflare" },
    tier: "saas",
    domain: "cloudflare.com",
  },
  {
    name: "Notion",
    slug: "notion",
    careersUrl: "https://www.notion.com/careers",
    sourceType: "ashby",
    sourceConfig: { boardToken: "notion" },
    tier: "saas",
    domain: "notion.so",
  },
  {
    name: "Figma",
    slug: "figma",
    careersUrl: "https://www.figma.com/careers/",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "figma" },
    tier: "saas",
    domain: "figma.com",
  },
  {
    name: "Canva",
    slug: "canva",
    careersUrl: "https://www.canva.com/careers/",
    sourceType: "generic",
    tier: "saas",
    enabled: false,
    domain: "canva.com",
  },
  {
    name: "Dropbox",
    slug: "dropbox",
    careersUrl: "https://jobs.dropbox.com/",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "dropbox" },
    tier: "saas",
    domain: "dropbox.com",
  },
  {
    name: "Okta",
    slug: "okta",
    careersUrl: "https://www.okta.com/company/careers/",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "okta" },
    tier: "saas",
    domain: "okta.com",
  },
  {
    name: "Elastic",
    slug: "elastic",
    careersUrl: "https://www.elastic.co/careers",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "elastic" },
    tier: "saas",
    domain: "elastic.co",
  },

  // AI / emerging
  {
    name: "OpenAI",
    slug: "openai",
    careersUrl: "https://openai.com/careers",
    sourceType: "ashby",
    sourceConfig: { boardToken: "openai" },
    tier: "ai",
    domain: "openai.com",
  },
  {
    name: "Anthropic",
    slug: "anthropic",
    careersUrl: "https://www.anthropic.com/careers",
    sourceType: "ashby",
    sourceConfig: { boardToken: "Anthropic" },
    tier: "ai",
    enabled: false,
    domain: "anthropic.com",
  },
  {
    name: "Databricks",
    slug: "databricks",
    careersUrl: "https://www.databricks.com/company/careers",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "databricks" },
    tier: "ai",
    domain: "databricks.com",
  },
  {
    name: "Snowflake",
    slug: "snowflake",
    careersUrl: "https://careers.snowflake.com/",
    sourceType: "ashby",
    sourceConfig: { boardToken: "snowflake" },
    tier: "ai",
    enabled: false,
    domain: "snowflake.com",
  },
  {
    name: "Perplexity",
    slug: "perplexity",
    careersUrl: "https://www.perplexity.ai/careers",
    sourceType: "ashby",
    sourceConfig: { boardToken: "perplexity" },
    tier: "ai",
    enabled: false,
    domain: "perplexity.ai",
  },
  {
    name: "Sarvam AI",
    slug: "sarvam-ai",
    careersUrl: "https://www.sarvam.ai/careers",
    sourceType: "generic",
    tier: "ai",
    enabled: false,
    domain: "sarvam.ai",
  },
  {
    name: "Krutrim",
    slug: "krutrim",
    careersUrl: "https://krutrim.com/careers",
    sourceType: "generic",
    tier: "ai",
    enabled: false,
    domain: "krutrim.com",
  },
  {
    name: "Mistral AI",
    slug: "mistral-ai",
    careersUrl: "https://mistral.ai/careers",
    sourceType: "generic",
    tier: "ai",
    enabled: false,
    domain: "mistral.ai",
  },
  {
    name: "Cohere",
    slug: "cohere",
    careersUrl: "https://cohere.com/careers",
    sourceType: "ashby",
    sourceConfig: { boardToken: "cohere" },
    tier: "ai",
    enabled: false,
    domain: "cohere.com",
  },
  {
    name: "Glean",
    slug: "glean",
    careersUrl: "https://www.glean.com/careers",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "gleanwork" },
    tier: "ai",
    domain: "glean.com",
  },
  {
    name: "Uniphore",
    slug: "uniphore",
    careersUrl: "https://www.uniphore.com/careers/",
    sourceType: "generic",
    tier: "ai",
    enabled: false,
    domain: "uniphore.com",
  },
  {
    name: "Yellow.ai",
    slug: "yellow-ai",
    careersUrl: "https://yellow.ai/careers/",
    sourceType: "generic",
    tier: "ai",
    enabled: false,
    domain: "yellow.ai",
  },
];

export const ALL_COMPANY_SEEDS = dedupeSeeds([...COMPANY_SEEDS, ...ADDITIONAL_COMPANY_SEEDS]);

