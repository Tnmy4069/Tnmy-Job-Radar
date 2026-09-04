import { prisma } from "../src/lib/db";

export type FailureClass =
  | "TRANSIENT_NETWORK"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "ACCESS_DENIED"
  | "CAPTCHA"
  | "ANTIBOT"
  | "WRONG_ATS"
  | "PARSER_FAILURE"
  | "EMPTY_SOURCE"
  | "INVALID_RESPONSE"
  | "SOURCE_CHANGED"
  | "UNSUPPORTED"
  | "UNKNOWN";

export function classifyFailure(input: {
  lastError?: string | null;
  lastBlockReason?: string | null;
  sourceNotes?: string | null;
  sourceType?: string | null;
}): FailureClass {
  const block = (input.lastBlockReason || "").toUpperCase();
  const text = `${input.lastError || ""} ${input.sourceNotes || ""}`.toLowerCase();

  if (block === "BLOCKED_BY_CAPTCHA" || text.includes("captcha")) return "CAPTCHA";
  if (block === "BLOCKED_BY_ANTIBOT" || text.includes("anti-bot") || text.includes("antibot")) {
    return "ANTIBOT";
  }
  if (block === "RATE_LIMITED" || text.includes("rate limited") || text.includes("http 429")) {
    return "RATE_LIMITED";
  }
  if (block === "ACCESS_DENIED" || text.includes("access denied") || text.includes("http 401") || text.includes("http 403")) {
    return "ACCESS_DENIED";
  }
  if (text.includes("timed out") || text.includes("timeout") || text.includes("http 408")) return "TIMEOUT";
  if (text.includes("fetch failed") || text.includes("econnreset") || text.includes("enotfound") || text.includes("network")) {
    return "TRANSIENT_NETWORK";
  }
  if (text.includes("disallowed by robots")) return "ACCESS_DENIED";
  if (
    (input.sourceType === "greenhouse" ||
      input.sourceType === "ashby" ||
      input.sourceType === "lever" ||
      input.sourceType === "smartrecruiters" ||
      input.sourceType === "workday") &&
    (text.includes("http 404") || text.includes("not found"))
  ) {
    return "WRONG_ATS";
  }
  if (text.includes("http 301") || text.includes("http 302") || text.includes("http 410")) {
    return "SOURCE_CHANGED";
  }
  if (text.includes("http 503") || text.includes("http 502") || text.includes("http 500")) {
    return "TRANSIENT_NETWORK";
  }
  if (
    text.includes("no usable jobs") ||
    text.includes("returned no usable") ||
    text.includes("application urls were missing") ||
    text.includes("not official")
  ) {
    return "EMPTY_SOURCE";
  }
  if (text.includes("unsupported") || text.includes("cannot parse")) return "UNSUPPORTED";
  if (text.includes("invalid") || text.includes("unexpected token") || text.includes("json")) {
    return "INVALID_RESPONSE";
  }
  return "UNKNOWN";
}

async function main() {
  const failed = await prisma.company.findMany({
    where: { sourceStatus: "FAILED" },
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      sourceType: true,
      sourceConfig: true,
      careersUrl: true,
      lastError: true,
      lastBlockReason: true,
      sourceNotes: true,
      consecutiveFailures: true,
      enabled: true,
    },
  });

  const groups: Record<string, typeof failed> = {};
  const rows = failed.map((row) => {
    const classification = classifyFailure(row);
    (groups[classification] ??= []).push(row);
    return {
      slug: row.slug,
      name: row.name,
      sourceType: row.sourceType,
      sourceConfig: row.sourceConfig,
      careersUrl: row.careersUrl,
      classification,
      lastError: row.lastError,
      lastBlockReason: row.lastBlockReason,
    };
  });

  const counts = Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [key, value.length])
  );

  console.log(
    JSON.stringify(
      {
        failed: failed.length,
        counts,
        byClass: Object.fromEntries(
          Object.entries(groups).map(([key, value]) => [
            key,
            value.map((row) => ({
              slug: row.slug,
              sourceType: row.sourceType,
              error: row.lastError || row.sourceNotes,
              careersUrl: row.careersUrl,
              sourceConfig: row.sourceConfig,
            })),
          ])
        ),
        rows,
      },
      null,
      2
    )
  );
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("/scripts/triage-failures.ts");

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}