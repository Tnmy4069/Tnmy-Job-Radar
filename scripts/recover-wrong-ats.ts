/**
 * Apply confirmed WRONG_ATS board recoveries and re-verify only those companies.
 * Does not run a full competing verification.
 */
import { prisma } from "../src/lib/db";
import { verifyCompanySource } from "../src/lib/companies/verify";

const RECOVERIES: Array<{
  slug: string;
  sourceType: string;
  sourceConfig: Record<string, unknown>;
  previousFailure: string;
  fix: string;
}> = [
  {
    slug: "block",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "block" },
    previousFailure: "WRONG_ATS greenhouse token square → 404",
    fix: "Correct Greenhouse boardToken to block",
  },
  {
    slug: "clickhouse",
    sourceType: "ashby",
    sourceConfig: { boardToken: "clickhouse" },
    previousFailure: "WRONG_ATS greenhouse token clickhouse → 404",
    fix: "Switch to Ashby boardToken clickhouse",
  },
  {
    slug: "cloudinary",
    sourceType: "lever",
    sourceConfig: { boardToken: "cloudinary" },
    previousFailure: "WRONG_ATS greenhouse token cloudinary → 404",
    fix: "Switch to Lever boardToken cloudinary",
  },
  {
    slug: "cohere",
    sourceType: "ashby",
    sourceConfig: { boardToken: "cohere" },
    previousFailure: "WRONG_ATS greenhouse token cohere → 404",
    fix: "Switch to Ashby boardToken cohere",
  },
  {
    slug: "confluent",
    sourceType: "ashby",
    sourceConfig: { boardToken: "confluent" },
    previousFailure: "WRONG_ATS greenhouse token confluent → 404",
    fix: "Switch to Ashby boardToken confluent",
  },
  {
    slug: "neon",
    sourceType: "ashby",
    sourceConfig: { boardToken: "neon" },
    previousFailure: "WRONG_ATS ashby token neondatabase → 404",
    fix: "Correct Ashby boardToken to neon",
  },
  {
    slug: "perplexity",
    sourceType: "ashby",
    sourceConfig: { boardToken: "perplexity" },
    previousFailure: "WRONG_ATS ashby token perplexityai → 404",
    fix: "Correct Ashby boardToken to perplexity",
  },
  {
    slug: "plaid",
    sourceType: "ashby",
    sourceConfig: { boardToken: "plaid" },
    previousFailure: "WRONG_ATS greenhouse token plaid → 404",
    fix: "Switch to Ashby boardToken plaid",
  },
  {
    slug: "planetscale",
    sourceType: "greenhouse",
    sourceConfig: { boardToken: "planetscale" },
    previousFailure: "WRONG_ATS ashby token planetscale → 404",
    fix: "Switch to Greenhouse boardToken planetscale",
  },
  {
    slug: "ramp",
    sourceType: "ashby",
    sourceConfig: { boardToken: "ramp" },
    previousFailure: "WRONG_ATS greenhouse token ramp → 404",
    fix: "Switch to Ashby boardToken ramp",
  },
  {
    slug: "redis",
    sourceType: "ashby",
    sourceConfig: { boardToken: "redis" },
    previousFailure: "WRONG_ATS greenhouse token redislabs → 404",
    fix: "Switch to Ashby boardToken redis",
  },
  {
    slug: "sentry",
    sourceType: "ashby",
    sourceConfig: { boardToken: "sentry" },
    previousFailure: "WRONG_ATS greenhouse token sentry → 404",
    fix: "Switch to Ashby boardToken sentry",
  },
  {
    slug: "snowflake",
    sourceType: "ashby",
    sourceConfig: { boardToken: "snowflake" },
    previousFailure: "WRONG_ATS greenhouse token snowflake → 404",
    fix: "Switch to Ashby boardToken snowflake",
  },
  {
    slug: "temporal",
    sourceType: "ashby",
    sourceConfig: { boardToken: "temporal" },
    previousFailure: "WRONG_ATS greenhouse token temporal → 404",
    fix: "Switch to Ashby boardToken temporal",
  },
];

async function main() {
  process.env.SOURCE_REQUEST_DELAY_MS ??= "350";
  process.env.SOURCE_VERIFY_CONCURRENCY ??= "2";
  process.env.COMPANY_SCAN_TIMEOUT_MS ??= "60000";

  const recovered: Array<{
    slug: string;
    previousFailure: string;
    fix: string;
    ats: string;
    jobs: number;
    status: string;
  }> = [];

  for (const row of RECOVERIES) {
    await prisma.company.update({
      where: { slug: row.slug },
      data: {
        sourceType: row.sourceType,
        sourceConfig: JSON.stringify(row.sourceConfig),
        sourceNotes: `Triage recovery: ${row.fix}`,
        enabled: false,
      },
    });
    const result = await verifyCompanySource(row.slug, { enableIfVerified: true });
    recovered.push({
      slug: row.slug,
      previousFailure: row.previousFailure,
      fix: row.fix,
      ats: result.atsType,
      jobs: result.jobsFound,
      status: result.sourceStatus,
    });
    console.log(`[recover] ${row.slug} → ${result.sourceStatus} jobs=${result.jobsFound} ats=${result.atsType}`);
  }

  const [verified, failed, unsupported] = await Promise.all([
    prisma.company.count({ where: { sourceStatus: "VERIFIED" } }),
    prisma.company.count({ where: { sourceStatus: "FAILED" } }),
    prisma.company.count({ where: { sourceStatus: "UNSUPPORTED" } }),
  ]);

  console.log(
    JSON.stringify(
      {
        recoveredOk: recovered.filter((row) => row.status === "VERIFIED"),
        recoveredStillFailed: recovered.filter((row) => row.status !== "VERIFIED"),
        totals: { verified, failed, unsupported },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
