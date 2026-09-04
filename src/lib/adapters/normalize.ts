import { resolveCountry } from "@/lib/location";
import type { NormalizedJob, RemoteType } from "./types";

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ["js", "ecmascript"],
  typescript: ["ts"],
  "next.js": ["nextjs", "next js"],
  "node.js": ["nodejs", "node js"],
  react: ["reactjs", "react.js"],
  "tailwind css": ["tailwind", "tailwindcss"],
  postgresql: ["postgres"],
  mongodb: ["mongo"],
  mysql: ["sql"],
  "rest apis": ["rest", "restful", "rest api"],
  "machine learning": ["ml"],
  "generative ai": ["genai", "gen ai"],
  llm: ["large language model", "llms"],
  "c++": ["cpp"],
};

const KNOWN_SKILLS = [
  "javascript",
  "typescript",
  "python",
  "react",
  "next.js",
  "node.js",
  "rest apis",
  "sql",
  "mongodb",
  "postgresql",
  "mysql",
  "git",
  "docker",
  "aws",
  "tailwind css",
  "html",
  "css",
  "c",
  "c++",
  "java",
  "prisma",
  "oauth",
  "ci/cd",
  "github actions",
  "vercel",
  "linux",
  "graph databases",
  "etl",
  "ai",
  "machine learning",
  "llm",
  "generative ai",
  "go",
  "golang",
  "kotlin",
  "swift",
  "rust",
  "kubernetes",
  "graphql",
  "redis",
  "kafka",
];

export function extractSkills(text: string): string[] {
  const hay = text.toLowerCase();
  const found = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    const aliases = [skill, ...(SKILL_ALIASES[skill] ?? [])];
    if (aliases.some((alias) => hay.includes(alias))) {
      found.add(canonicalSkill(skill));
    }
  }
  return [...found];
}

function canonicalSkill(skill: string): string {
  const map: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    react: "React",
    "next.js": "Next.js",
    "node.js": "Node.js",
    "rest apis": "REST APIs",
    sql: "SQL",
    mongodb: "MongoDB",
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    git: "Git",
    docker: "Docker",
    aws: "AWS",
    "tailwind css": "Tailwind CSS",
    html: "HTML",
    css: "CSS",
    c: "C",
    "c++": "C++",
    java: "Java",
    prisma: "Prisma",
    oauth: "OAuth",
    "ci/cd": "CI/CD",
    "github actions": "GitHub Actions",
    vercel: "Vercel",
    linux: "Linux",
    "graph databases": "Graph databases",
    etl: "ETL",
    ai: "AI",
    "machine learning": "Machine Learning",
    llm: "LLM",
    "generative ai": "Generative AI",
    go: "Go",
    golang: "Go",
    kotlin: "Kotlin",
    swift: "Swift",
    rust: "Rust",
    kubernetes: "Kubernetes",
    graphql: "GraphQL",
    redis: "Redis",
    kafka: "Kafka",
  };
  return map[skill] ?? skill;
}

export function inferRemoteType(text: string): RemoteType {
  const hay = text.toLowerCase();
  if (/\bremote\b/.test(hay) && /\bhybrid\b/.test(hay)) return "hybrid";
  if (/\bhybrid\b/.test(hay)) return "hybrid";
  if (/\bremote\b/.test(hay) || /\bwork from home\b/.test(hay)) return "remote";
  if (/\bon[- ]?site\b|\bin[- ]?office\b/.test(hay)) return "onsite";
  return "unknown";
}

export function inferCountry(location: string): string {
  return resolveCountry(location);
}

export function inferExperienceLevel(text: string): string {
  const hay = text.toLowerCase();
  if (/\b(new grad|new graduate|university grad|early career|fresh graduate|entry[- ]level|junior|graduate software|0-2|0–2)\b/.test(hay)) {
    return "entry";
  }
  if (/\b(intern|internship)\b/.test(hay) && !/\bengineer\b|\bdeveloper\b|\bsde\b/.test(hay)) {
    return "intern";
  }
  if (/\b(senior|staff|principal|lead|manager|director|architect)\b/.test(hay)) {
    return "senior";
  }
  if (/\b(3-5|3–5|mid[- ]level|sde ii|sde 2|software engineer ii|software engineer 2)\b/.test(hay)) {
    return "mid";
  }
  return "unspecified";
}

export function inferEmploymentType(text: string): string {
  const hay = text.toLowerCase();
  if (/\bintern\b/.test(hay)) return "internship";
  if (/\bcontract\b/.test(hay)) return "contract";
  if (/\bpart[- ]time\b/.test(hay)) return "part-time";
  return "full-time";
}

export function completeJob(
  job: Partial<NormalizedJob> & Pick<NormalizedJob, "title" | "applicationUrl" | "sourceUrl" | "sourceType">
): NormalizedJob {
  const blob = [job.title, job.location, job.description, job.department, job.team]
    .filter(Boolean)
    .join("\n");
  return {
    externalId: job.externalId,
    title: job.title.trim(),
    description: job.description ?? "",
    location: job.location ?? "",
    country: job.country || inferCountry(job.location ?? ""),
    employmentType: job.employmentType || inferEmploymentType(blob),
    experienceLevel: job.experienceLevel || inferExperienceLevel(blob),
    department: job.department ?? "",
    team: job.team ?? "",
    skills: job.skills?.length ? job.skills : extractSkills(blob),
    salary: job.salary,
    remoteType: job.remoteType ?? inferRemoteType(blob),
    applicationUrl: job.applicationUrl,
    sourceUrl: job.sourceUrl,
    sourceType: job.sourceType,
    postedAt: job.postedAt,
  };
}

export function parseRelativeDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const absolute = Date.parse(value);
  if (!Number.isNaN(absolute)) return new Date(absolute);

  const hay = value.toLowerCase();
  const now = new Date();
  const dayMatch = hay.match(/(\d+)\s+day/);
  if (dayMatch) {
    now.setDate(now.getDate() - Number(dayMatch[1]));
    return now;
  }
  if (/today|just posted|hours? ago|minutes? ago/.test(hay)) return new Date();
  if (/yesterday/.test(hay)) {
    now.setDate(now.getDate() - 1);
    return now;
  }
  if (/30\+/.test(hay)) {
    now.setDate(now.getDate() - 30);
    return now;
  }
  return undefined;
}
