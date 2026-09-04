/**
 * Probe WRONG_ATS failed companies: fetch official careers HTML, detect ATS,
 * and optionally try known alternate Greenhouse/Ashby board tokens.
 * Read-only discovery — does not enable companies.
 */
import { detectAtsFromHtml, detectAtsFromUrl } from "../src/lib/discovery/ats-detect";
import { fetchJson, fetchText } from "../src/lib/http";
import { prisma } from "../src/lib/db";
import { classifyFailure } from "./triage-failures";

const ALTERNATES: Record<string, Array<{ type: string; config: Record<string, unknown> }>> = {
  anthropic: [
    { type: "ashby", config: { boardToken: "anthropic" } },
    { type: "ashby", config: { boardToken: "Anthropic" } },
  ],
  block: [
    { type: "greenhouse", config: { boardToken: "block" } },
    { type: "greenhouse", config: { boardToken: "square" } },
    { type: "ashby", config: { boardToken: "block" } },
  ],
  chargebee: [
    { type: "greenhouse", config: { boardToken: "chargebeeinc" } },
    { type: "lever", config: { boardToken: "chargebee" } },
    { type: "ashby", config: { boardToken: "chargebee" } },
  ],
  clickhouse: [
    { type: "ashby", config: { boardToken: "clickhouse" } },
    { type: "greenhouse", config: { boardToken: "clickhouseinc" } },
  ],
  cloudinary: [
    { type: "greenhouse", config: { boardToken: "cloudinaryinc" } },
    { type: "lever", config: { boardToken: "cloudinary" } },
  ],
  cohere: [
    { type: "ashby", config: { boardToken: "cohere" } },
    { type: "greenhouse", config: { boardToken: "cohereai" } },
  ],
  confluent: [
    { type: "greenhouse", config: { boardToken: "confluentinc" } },
    { type: "ashby", config: { boardToken: "confluent" } },
  ],
  datastax: [
    { type: "greenhouse", config: { boardToken: "datastaxinc" } },
    { type: "lever", config: { boardToken: "datastax" } },
  ],
  digitalocean: [
    { type: "greenhouse", config: { boardToken: "digitaloceanhq" } },
    { type: "ashby", config: { boardToken: "digitalocean" } },
    { type: "lever", config: { boardToken: "digitalocean" } },
  ],
  doordash: [
    { type: "greenhouse", config: { boardToken: "doordashinc" } },
    { type: "ashby", config: { boardToken: "doordash" } },
  ],
  grammarly: [
    { type: "greenhouse", config: { boardToken: "grammarlyinc" } },
    { type: "lever", config: { boardToken: "grammarly" } },
    { type: "ashby", config: { boardToken: "grammarly" } },
  ],
  hashicorp: [
    { type: "greenhouse", config: { boardToken: "hashicorpinc" } },
    { type: "ashby", config: { boardToken: "hashicorp" } },
  ],
  hasura: [
    { type: "greenhouse", config: { boardToken: "hasuralabs" } },
    { type: "ashby", config: { boardToken: "hasura" } },
    { type: "lever", config: { boardToken: "hasura" } },
  ],
  neon: [
    { type: "ashby", config: { boardToken: "neon" } },
    { type: "greenhouse", config: { boardToken: "neondatabase" } },
  ],
  perplexity: [
    { type: "ashby", config: { boardToken: "perplexity" } },
    { type: "ashby", config: { boardToken: "perplexityai" } },
  ],
  plaid: [
    { type: "greenhouse", config: { boardToken: "plaidinc" } },
    { type: "ashby", config: { boardToken: "plaid" } },
  ],
  planetscale: [
    { type: "ashby", config: { boardToken: "PlanetScale" } },
    { type: "greenhouse", config: { boardToken: "planetscaleinc" } },
  ],
  ramp: [
    { type: "ashby", config: { boardToken: "ramp" } },
    { type: "greenhouse", config: { boardToken: "rampbusiness" } },
  ],
  redis: [
    { type: "greenhouse", config: { boardToken: "redis" } },
    { type: "ashby", config: { boardToken: "redis" } },
    { type: "lever", config: { boardToken: "redis" } },
  ],
  rippling: [
    { type: "ashby", config: { boardToken: "rippling" } },
    { type: "greenhouse", config: { boardToken: "ripplinginc" } },
  ],
  sentry: [
    { type: "greenhouse", config: { boardToken: "getsentry" } },
    { type: "ashby", config: { boardToken: "sentry" } },
  ],
  snowflake: [
    { type: "greenhouse", config: { boardToken: "snowflakecomputing" } },
    { type: "ashby", config: { boardToken: "snowflake" } },
  ],
  temporal: [
    { type: "greenhouse", config: { boardToken: "temporaltechnologies" } },
    { type: "ashby", config: { boardToken: "temporal" } },
  ],
  thoughtspot: [
    { type: "greenhouse", config: { boardToken: "thoughtspotinc" } },
    { type: "lever", config: { boardToken: "thoughtspot" } },
  ],
  "weights-biases": [
    { type: "greenhouse", config: { boardToken: "wandb" } },
    { type: "ashby", config: { boardToken: "weightsandbiases" } },
  ],
  "dbt-labs": [
    { type: "greenhouse", config: { boardToken: "dbtlabs" } },
    { type: "ashby", config: { boardToken: "dbt" } },
  ],
  hubspot: [{ type: "greenhouse", config: { boardToken: "hubspot" } }],
  contentful: [
    { type: "greenhouse", config: { boardToken: "contentful" } },
    { type: "ashby", config: { boardToken: "contentful" } },
  ],
};

async function probeBoard(type: string, config: Record<string, unknown>): Promise<number | null> {
  try {
    if (type === "greenhouse") {
      const token = String(config.boardToken);
      const data = await fetchJson<{ jobs?: unknown[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`
      );
      return data.jobs?.length ?? 0;
    }
    if (type === "ashby") {
      const token = String(config.boardToken);
      const data = await fetchJson<{ jobs?: unknown[]; results?: unknown[] }>(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`
      );
      return (data.jobs ?? data.results)?.length ?? 0;
    }
    if (type === "lever") {
      const token = String(config.boardToken);
      const data = await fetchJson<unknown[]>(
        `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`
      );
      return Array.isArray(data) ? data.length : 0;
    }
  } catch {
    return null;
  }
  return null;
}

async function main() {
  process.env.SOURCE_REQUEST_DELAY_MS ??= "300";
  const failed = await prisma.company.findMany({
    where: { sourceStatus: "FAILED" },
    orderBy: { slug: "asc" },
  });
  const targets = failed.filter((row) => {
    const c = classifyFailure(row);
    return c === "WRONG_ATS" || c === "EMPTY_SOURCE" || (c === "UNKNOWN" && row.sourceType === "generic");
  });

  const findings: unknown[] = [];
  for (const company of targets) {
    let pageDetect = null as ReturnType<typeof detectAtsFromUrl>;
    let htmlDetect = null as ReturnType<typeof detectAtsFromHtml>;
    let htmlError: string | null = null;
    try {
      const page = await fetchText(company.careersUrl, {}, { respectRobots: true });
      pageDetect = detectAtsFromUrl(company.careersUrl);
      htmlDetect = detectAtsFromHtml(page, company.careersUrl);
    } catch (error) {
      htmlError = error instanceof Error ? error.message : "fetch failed";
    }

    const candidates = [
      ...(htmlDetect ? [{ type: htmlDetect.type, config: htmlDetect.config, via: "html" }] : []),
      ...(pageDetect ? [{ type: pageDetect.type, config: pageDetect.config, via: "url" }] : []),
      ...(ALTERNATES[company.slug] ?? []).map((row) => ({ ...row, via: "alternate" })),
    ];

    const working: Array<{ type: string; config: Record<string, unknown>; via: string; jobs: number }> = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const key = `${candidate.type}:${JSON.stringify(candidate.config)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const jobs = await probeBoard(candidate.type, candidate.config);
      if (jobs != null && jobs > 0) {
        working.push({ type: candidate.type, config: candidate.config, via: candidate.via, jobs });
      }
    }

    findings.push({
      slug: company.slug,
      currentType: company.sourceType,
      currentConfig: company.sourceConfig,
      careersUrl: company.careersUrl,
      htmlError,
      htmlDetect,
      working,
    });
    console.log(
      `[probe] ${company.slug}: ${working.length ? working.map((w) => `${w.type}/${JSON.stringify(w.config)}=${w.jobs}`).join("; ") : htmlError || "no working board"}`
    );
  }

  console.log(JSON.stringify({ probed: findings.length, findings }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
