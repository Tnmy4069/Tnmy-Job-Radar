export type BlockReason =
  | "BLOCKED_BY_CAPTCHA"
  | "BLOCKED_BY_ANTIBOT"
  | "RATE_LIMITED"
  | "ACCESS_DENIED";

export const BLOCK_REASONS: BlockReason[] = [
  "BLOCKED_BY_CAPTCHA",
  "BLOCKED_BY_ANTIBOT",
  "RATE_LIMITED",
  "ACCESS_DENIED",
];

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isTransientHttpStatus(status: number): boolean {
  return TRANSIENT_STATUS.has(status);
}

/** Never retry auth walls, CAPTCHA, or anti-bot challenges. */
export function shouldRetryHttpStatus(status: number): boolean {
  if (status === 401 || status === 403) return false;
  return isTransientHttpStatus(status);
}

function headerValue(
  headers: Headers | Record<string, string> | undefined,
  name: string
): string {
  if (!headers) return "";
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name)?.toLowerCase() ?? "";
  }
  const rec = headers as Record<string, string>;
  const match = Object.entries(rec).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return (match?.[1] ?? "").toLowerCase();
}

function isCaptchaBody(hay: string): boolean {
  return (
    hay.includes("g-recaptcha") ||
    hay.includes("grecaptcha") ||
    hay.includes("h-captcha") ||
    hay.includes("hcaptcha.com") ||
    hay.includes("cf-turnstile") ||
    hay.includes("challenges.cloudflare.com/turnstile") ||
    hay.includes("why do i have to complete a captcha") ||
    hay.includes("data-callback=\"oncaptcha")
  );
}

function isAntibotBody(hay: string, cfMitigated: string): boolean {
  if (cfMitigated === "challenge") return true;
  if (hay.includes("cf-browser-verification")) return true;
  if (hay.includes("cdn-cgi/challenge-platform")) return true;
  if (hay.includes("_cf_chl")) return true;
  if (hay.includes("checking if the site connection is secure")) return true;
  if (hay.includes("attention required! | cloudflare")) return true;
  if (hay.includes("just a moment") && hay.includes("cloudflare")) return true;
  if (hay.includes("enable javascript and cookies to continue") && hay.includes("cloudflare")) {
    return true;
  }
  return false;
}

export function classifyHttpBlock(input: {
  status: number;
  body?: string;
  headers?: Headers | Record<string, string>;
}): BlockReason | null {
  const body = (input.body ?? "").slice(0, 80_000);
  const hay = body.toLowerCase();
  const cfMitigated = headerValue(input.headers, "cf-mitigated");

  if (input.status === 429) return "RATE_LIMITED";

  if (isCaptchaBody(hay)) return "BLOCKED_BY_CAPTCHA";
  if (isAntibotBody(hay, cfMitigated)) return "BLOCKED_BY_ANTIBOT";

  if (input.status === 401 || input.status === 403) return "ACCESS_DENIED";

  return null;
}

export function blockReasonMessage(reason: BlockReason): string {
  switch (reason) {
    case "BLOCKED_BY_CAPTCHA":
      return "Blocked by CAPTCHA";
    case "BLOCKED_BY_ANTIBOT":
      return "Blocked by anti-bot challenge";
    case "RATE_LIMITED":
      return "Rate limited";
    case "ACCESS_DENIED":
      return "Access denied";
  }
}
