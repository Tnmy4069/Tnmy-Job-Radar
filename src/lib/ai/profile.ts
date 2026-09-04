import { candidateProfileVersion } from "./config";

export const CANDIDATE_PROFILE = {
  careerStage: "Fresh graduate / early career",
  experienceTarget: "0–2 years",
  targetRoles: [
    "Software Engineer",
    "Software Development Engineer",
    "SDE",
    "SDE I",
    "Software Engineer I",
    "Associate Software Engineer",
    "Graduate Software Engineer",
    "Junior Software Engineer",
    "Full Stack Engineer",
    "Frontend Engineer",
    "Backend Engineer",
    "Product Engineer",
    "Web Engineer",
    "Software Developer",
    "Application Developer",
    "AI Engineer",
    "ML Engineer",
    "AI/ML Engineer",
  ],
  primarySkills: [
    "JavaScript",
    "TypeScript",
    "Python",
    "React",
    "Next.js",
    "Node.js",
    "REST APIs",
    "SQL",
    "MongoDB",
    "PostgreSQL",
    "MySQL",
    "Git",
    "Docker",
    "AWS",
    "Tailwind CSS",
    "HTML",
    "CSS",
  ],
  additionalSkills: [
    "C",
    "C++",
    "Java",
    "Prisma",
    "OAuth",
    "CI/CD",
    "GitHub Actions",
    "Vercel",
    "Linux",
    "ETL",
    "AI",
    "Machine Learning",
    "LLM",
    "Generative AI",
  ],
  preferredLocations: [
    "Bangalore / Bengaluru",
    "Hyderabad",
    "Pune",
    "Mumbai",
    "Delhi NCR",
    "Gurgaon / Gurugram",
    "Noida",
    "Chennai",
    "Remote India",
  ],
} as const;

export type CandidateProfile = typeof CANDIDATE_PROFILE & { version: string };

let cached: CandidateProfile | null = null;
let cachedVersion = "";

export function getCandidateProfile(): CandidateProfile {
  const version = candidateProfileVersion();
  if (cached && cachedVersion === version) return cached;
  cachedVersion = version;
  cached = { ...CANDIDATE_PROFILE, version };
  return cached;
}

export function candidateProfileForPrompt(profile = getCandidateProfile()) {
  return {
    version: profile.version,
    careerStage: profile.careerStage,
    experienceTarget: profile.experienceTarget,
    targetRoles: [...profile.targetRoles],
    primarySkills: [...profile.primarySkills],
    additionalSkills: [...profile.additionalSkills],
    preferredLocations: [...profile.preferredLocations],
  };
}

export function resetCandidateProfileCacheForTests() {
  cached = null;
  cachedVersion = "";
}
