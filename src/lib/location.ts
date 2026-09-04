const CITY_COUNTRY: Record<string, string> = {
  bangalore: "India",
  bengaluru: "India",
  hyderabad: "India",
  pune: "India",
  mumbai: "India",
  delhi: "India",
  "new delhi": "India",
  ncr: "India",
  "delhi ncr": "India",
  gurgaon: "India",
  gurugram: "India",
  noida: "India",
  chennai: "India",
  kolkata: "India",
  ahmedabad: "India",
  jaipur: "India",
  kochi: "India",
  coimbatore: "India",
  indore: "India",
  chandigarh: "India",
  lucknow: "India",
  thane: "India",
  navimumbai: "India",
  "navi mumbai": "India",

  "san francisco": "United States",
  seattle: "United States",
  "new york": "United States",
  "new york city": "United States",
  nyc: "United States",
  austin: "United States",
  boston: "United States",
  chicago: "United States",
  denver: "United States",
  atlanta: "United States",
  sunnyvale: "United States",
  "mountain view": "United States",
  cupertino: "United States",
  "palo alto": "United States",
  redmond: "United States",
  "los angeles": "United States",
  "san jose": "United States",
  bellevue: "United States",
  portland: "United States",
  miami: "United States",
  dallas: "United States",
  houston: "United States",

  london: "United Kingdom",
  manchester: "United Kingdom",
  cambridge: "United Kingdom",
  edinburgh: "United Kingdom",

  dublin: "Ireland",
  cork: "Ireland",

  toronto: "Canada",
  vancouver: "Canada",
  montreal: "Canada",
  ottawa: "Canada",

  berlin: "Germany",
  munich: "Germany",
  hamburg: "Germany",
  frankfurt: "Germany",

  paris: "France",
  amsterdam: "Netherlands",
  zurich: "Switzerland",
  geneva: "Switzerland",
  stockholm: "Sweden",
  copenhagen: "Denmark",
  barcelona: "Spain",
  madrid: "Spain",
  lisbon: "Portugal",
  bucharest: "Romania",
  warsaw: "Poland",
  prague: "Czech Republic",

  singapore: "Singapore",
  tokyo: "Japan",
  osaka: "Japan",
  seoul: "South Korea",
  sydney: "Australia",
  melbourne: "Australia",
  "hong kong": "Hong Kong",
  dubai: "United Arab Emirates",
  telaviv: "Israel",
  "tel aviv": "Israel",
};

/** Canonical display names for known city aliases. */
const CITY_CANONICAL: Record<string, string> = {
  bengaluru: "Bangalore",
  bangalore: "Bangalore",
  gurugram: "Gurgaon",
  gurgaon: "Gurgaon",
  "new delhi": "Delhi NCR",
  delhi: "Delhi NCR",
  ncr: "Delhi NCR",
  "delhi ncr": "Delhi NCR",
  noida: "Delhi NCR",
  "navi mumbai": "Mumbai",
  navimumbai: "Mumbai",
  nyc: "New York",
  "new york city": "New York",
  "tel aviv": "Tel Aviv",
  telaviv: "Tel Aviv",
};

const COUNTRY_ALIASES: Record<string, string> = {
  india: "India",
  ind: "India",
  in: "India",
  "united states": "United States",
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  gbr: "United Kingdom",
  canada: "Canada",
  can: "Canada",
  germany: "Germany",
  deu: "Germany",
  ireland: "Ireland",
  irl: "Ireland",
  singapore: "Singapore",
  sgp: "Singapore",
  australia: "Australia",
  aus: "Australia",
  france: "France",
  fra: "France",
  netherlands: "Netherlands",
  nld: "Netherlands",
  switzerland: "Switzerland",
  spain: "Spain",
  romania: "Romania",
  japan: "Japan",
  "south korea": "South Korea",
  israel: "Israel",
  "united arab emirates": "United Arab Emirates",
  uae: "United Arab Emirates",
};

const SKIP_TOKENS = new Set([
  "remote",
  "hybrid",
  "onsite",
  "on-site",
  "in-office",
  "in office",
  "office",
  "worldwide",
  "multiple",
  "locations",
  "various",
  "karnataka",
  "telangana",
  "maharashtra",
  "tamil nadu",
  "california",
  "washington",
  "texas",
  "england",
  "ontario",
]);

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokensFromLocation(location: string): string[] {
  return location
    .split(/[,|/·•]+/)
    .map((part) => normalizeToken(part))
    .filter(Boolean);
}

function canonicalizeCity(raw: string): string {
  const key = normalizeToken(raw);
  if (CITY_CANONICAL[key]) return CITY_CANONICAL[key];
  return titleCase(raw);
}

export function extractCity(location: string): string {
  if (!location) return "";
  const parts = tokensFromLocation(location);
  for (const part of parts) {
    if (CITY_COUNTRY[part] || CITY_CANONICAL[part]) {
      return canonicalizeCity(part);
    }
  }
  const first = parts.find(
    (part) => !COUNTRY_ALIASES[part] && !SKIP_TOKENS.has(part) && part.length > 1
  );
  return first ? canonicalizeCity(first) : "";
}

export function resolveCountry(location: string, storedCountry?: string): string {
  const stored = normalizeToken(storedCountry ?? "");
  if (stored && COUNTRY_ALIASES[stored]) return COUNTRY_ALIASES[stored];
  if (storedCountry && storedCountry.length > 2 && !/^[A-Z]{2,3}$/.test(storedCountry)) {
    return storedCountry;
  }

  const hay = normalizeToken(`${location} ${storedCountry ?? ""}`);
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (new RegExp(`\\b${alias.replace(".", "\\.")}\\b`).test(hay)) return country;
  }

  const parts = tokensFromLocation(location);
  for (const part of parts) {
    if (CITY_COUNTRY[part]) return CITY_COUNTRY[part];
  }

  for (const [city, country] of Object.entries(CITY_COUNTRY)) {
    if (hay.includes(city)) return country;
  }

  return storedCountry?.trim() || "";
}

/** Normalize a raw ATS location into city + country + display location. */
export function normalizeLocation(rawLocation: string, storedCountry?: string) {
  const raw = (rawLocation || "").trim();
  const city = extractCity(raw);
  const country = resolveCountry(raw, storedCountry);
  const location =
    city && country ? `${city}, ${country}` : city || country || raw;
  return { rawLocation: raw, city, country, location };
}

export function isIndiaLocation(
  city: string,
  country: string,
  remoteType?: string,
  location?: string
): boolean {
  if (country === "India") return true;
  const hay = `${city} ${country} ${location ?? ""} ${remoteType ?? ""}`.toLowerCase();
  return /\bindia\b|bangalore|bengaluru|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad|kochi|indore|coimbatore|remote india/.test(
    hay
  );
}

export function countrySortKey(country: string): string {
  if (!country) return "zzz-unknown";
  if (country === "India") return "0-india";
  return `1-${country.toLowerCase()}`;
}

export function citySortKey(city: string): string {
  return (city || "zzz").toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
