const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function stripPostedPrefix(value: string): string {
  return value.replace(/^\s*(posted|updated|date posted|published)\s*:?\s*/i, "").trim();
}

function fromParts(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1990 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function parseNamedMonth(value: string): Date | null {
  const match = value.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i
  );
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase().replace(".", "")];
  if (month == null) return null;
  return fromParts(Number(match[3]), month, Number(match[2]));
}

function parseTimestamp(value: number): Date | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : null;
  if (ms == null) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRelative(value: string, now: Date): Date | null {
  const hay = value.toLowerCase();
  if (/^(today|just posted|just now)$/.test(hay)) return new Date(now);
  if (/\b(hours?|minutes?|mins?)\s+ago\b/.test(hay) || /\bposted\s+today\b/.test(hay)) {
    return new Date(now);
  }
  if (/\byesterday\b/.test(hay)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date;
  }

  const week = hay.match(/\b(\d+)\s+weeks?\s+ago\b/);
  if (week) {
    const date = new Date(now);
    date.setDate(date.getDate() - Number(week[1]) * 7);
    return date;
  }
  const day = hay.match(/\b(\d+)\s+days?\s+ago\b/);
  if (day) {
    const date = new Date(now);
    date.setDate(date.getDate() - Number(day[1]));
    return date;
  }
  if (/30\+/.test(hay)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 30);
    return date;
  }
  return null;
}

/**
 * Parse a posted/updated date from official source fields.
 * Returns null when the value cannot be parsed. Never invents a date.
 */
export function parseJobDate(value?: string | number | Date | null, now = new Date()): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") return parseTimestamp(value);

  const trimmed = stripPostedPrefix(String(value).trim());
  if (!trimmed) return null;

  if (/^\d{9,13}$/.test(trimmed)) return parseTimestamp(Number(trimmed));

  const named = parseNamedMonth(trimmed);
  if (named) return named;

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return new Date(iso);

  return parseRelative(trimmed, now);
}
