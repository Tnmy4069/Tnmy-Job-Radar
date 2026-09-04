import sanitizeHtml from "sanitize-html";

const JUNK_LINE =
  /^(accept (all )?cookies|cookie (policy|settings)|we use cookies|privacy policy|terms of (use|service)|all rights reserved|sign in|log in|subscribe to our newsletter|manage (cookie|consent))$/i;

const KEEP_HEADING =
  /^(responsibilities|requirements|qualifications|preferred qualifications|about the role|what you.?ll do|minimum qualifications|basic qualifications|nice to have|about (the )?job|the role)$/i;

function decodeEntities(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function dropJunk(text: string): string {
  const lines = text.split(/\n+/);
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length < 80 && JUNK_LINE.test(trimmed) && !KEEP_HEADING.test(trimmed)) continue;
    kept.push(trimmed);
  }
  const deduped: string[] = [];
  for (const line of kept) {
    if (deduped[deduped.length - 1] === line) continue;
    deduped.push(line);
  }
  return deduped.join("\n\n");
}

/** Full job description from HTML, plain text, or JSON. Never stops at the first paragraph. */
export function normalizeDescription(value?: string | null): string {
  if (!value) return "";
  const decoded = decodeEntities(String(value));
  const withBreaks = decoded
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return dropJunk(text);
}

export function looksLikeThinDescription(value: string): boolean {
  return normalizeDescription(value).length < 80;
}

/** Keep a stored description when the new observation is empty or clearly thinner. */
export function mergeDescription(incoming: string, existing: string): string {
  const next = incoming.trim();
  const prev = existing.trim();
  if (!next) return existing;
  if (!prev) return incoming;
  if (next.length < 80 && prev.length > next.length) return existing;
  return incoming;
}
