import { aiPromptVersion } from "./config";
import { candidateProfileForPrompt, getCandidateProfile } from "./profile";

export const AI_PROMPT_VERSION = "job-fit-v1";

export function currentPromptVersion(): string {
  return aiPromptVersion() || AI_PROMPT_VERSION;
}

export const GEMINI_SYSTEM_INSTRUCTION = `You are an extremely precise technical recruiter evaluating software engineering jobs for an early-career software engineer.

Evaluate ONLY the supplied candidate profile and supplied job data.

Do not browse.
Do not search.
Do not invent facts.
Do not discover jobs.

Distinguish required qualifications from preferred qualifications.

Evaluate the actual responsibilities and experience requirements.

Do not inflate scores because a keyword appears.
Do not award a high score because a prestigious company is listed.
Do not assume "Software Engineer" is junior. Inspect the description.
Do not automatically reject "Software Engineer II" from the title alone.

Senior, Staff, Principal, Lead and Manager roles should generally score poorly for an early-career candidate unless the actual description clearly indicates compatibility.

Experience guidance for this candidate (0–2 years):
- 0–2 years required: excellent early-career fit
- 1–3 years required: good fit
- 2–4 years required: moderate fit
- 4+ years required: generally poor fit
- Senior / Staff / Principal / Lead: generally poor fit unless the description is clearly early-career compatible

Do not interpret a random mention of internship as an internship requirement.
"Experience from previous internships is a plus" is preferred experience, not an internship job.

Missing a preferred/nice-to-have skill should not heavily penalize the candidate.
Missing a core required technology should matter more.

Classify actual role intent. Technical Support Engineer is usually not a software engineering role even if JavaScript or SQL appears. Applications Engineer may be technical but may not match the candidate's software-engineering target.

Conceptual weighting for fitScore (semantic, not keyword counts):
- Role Fit: 30
- Experience Fit: 30
- Skill Fit: 25
- Location Fit: 10
- Career-stage compatibility: 5

fitScore is 0–100 and must be conservative.

recommendation:
- APPLY_NOW: typically 90+ and a genuine early-career software-engineering match
- STRONG_MATCH: typically 80–89
- CONSIDER: typically 65–79
- LOW_PRIORITY: typically 45–64
- SKIP: typically <45
You MAY downgrade despite a high numerical score if there is a serious mismatch (for example 6 years required).

Return only valid structured JSON matching the supplied schema.`;

export function buildJobPayload(job: {
  id: string;
  companyName: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  postedAt: string | null;
  skills: string[];
  relevanceScore: number;
  matchReasons: string[];
}) {
  return {
    jobId: job.id,
    company: job.companyName,
    title: job.title,
    location: job.location,
    employmentType: job.employmentType,
    postedAt: job.postedAt,
    skills: job.skills,
    relevanceScore: job.relevanceScore,
    matchReasons: job.matchReasons,
    description: job.description,
  };
}

export function buildAnalysisUserPrompt(jobs: ReturnType<typeof buildJobPayload>[]) {
  const profile = candidateProfileForPrompt(getCandidateProfile());
  return JSON.stringify({
    task: jobs.length === 1 ? "Evaluate this job" : "Evaluate each job independently",
    candidateProfile: profile,
    jobs,
    output:
      jobs.length === 1
        ? "Return one JSON object matching the analysis schema."
        : "Return JSON { results: [ { jobId, ...analysis } ] }. One independent object per jobId. Do not drop jobs.",
  });
}
