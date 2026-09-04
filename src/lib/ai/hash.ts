import { createHash } from "crypto";
import { currentPromptVersion } from "./prompt";
import { getCandidateProfile } from "./profile";

export function computeAiAnalysisHash(input: {
  jobId: string;
  title: string;
  description: string;
  skills: string[] | string;
  location: string;
  employmentType: string;
  candidateProfileVersion?: string;
  promptVersion?: string;
}): string {
  const skills = Array.isArray(input.skills) ? input.skills.join(",") : input.skills;
  const raw = [
    input.jobId,
    input.title.trim(),
    input.description.trim(),
    skills,
    input.location.trim(),
    input.employmentType.trim(),
    input.candidateProfileVersion ?? getCandidateProfile().version,
    input.promptVersion ?? currentPromptVersion(),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}
