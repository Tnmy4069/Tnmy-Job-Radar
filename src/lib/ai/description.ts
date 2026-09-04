import { stripHtml } from "@/lib/sanitize";

const MAX_CHARS = 7000;
const SECTION_RE =
  /^(about the role|the role|what you.?ll do|what you will do|responsibilit|requirements?|qualifications?|minimum qualifications?|basic qualifications?|preferred qualifications?|preferred|nice to have|skills|experience|must have|who you are)\b/i;

export function normalizeJobDescription(htmlOrText: string): string {
  const text = stripHtml(htmlOrText || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= MAX_CHARS) return text;

  const lines = text.split(/\n+/);
  const sections: string[] = [];
  let current: string[] = [];
  let keep = false;

  const flush = () => {
    if (keep && current.length) sections.push(current.join(" ").trim());
    current = [];
    keep = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (SECTION_RE.test(trimmed) || (trimmed.length < 80 && SECTION_RE.test(trimmed.replace(/:$/, "")))) {
      flush();
      keep = true;
      current = [trimmed];
      continue;
    }
    if (keep) current.push(trimmed);
  }
  flush();

  const important = sections.filter(Boolean).join("\n\n");
  if (important.length >= 400) return important.slice(0, MAX_CHARS);

  const requirements = extractWindow(text, /(requirements?|qualifications?|responsibilit)/i);
  if (requirements) return requirements.slice(0, MAX_CHARS);

  return text.slice(Math.max(0, text.length - MAX_CHARS));
}

function extractWindow(text: string, marker: RegExp): string | null {
  const match = marker.exec(text);
  if (!match || match.index == null) return null;
  const start = Math.max(0, match.index - 400);
  return text.slice(start, start + MAX_CHARS);
}
