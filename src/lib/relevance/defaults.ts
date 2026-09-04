export const DEFAULT_TITLES = [
  "Software Engineer",
  "Software Development Engineer",
  "SDE",
  "SDE I",
  "Software Engineer I",
  "Associate Software Engineer",
  "Graduate Software Engineer",
  "Junior Software Engineer",
  "Full Stack Developer",
  "Full Stack Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Web Engineer",
  "Software Developer",
  "Application Developer",
  "Product Engineer",
  "AI Engineer",
  "ML Engineer",
  "AI/ML Engineer",
];

/** Excellent title matches — +35 */
export const EXCELLENT_TITLE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Software Engineer", pattern: /\bsoftware engineer\b/i },
  { label: "Software Development Engineer", pattern: /\bsoftware development engineer\b/i },
  { label: "SDE", pattern: /\bsde\b/i },
  { label: "SDE I", pattern: /\bsde\s*i\b|\bsde\s*1\b/i },
  { label: "Software Engineer I", pattern: /\bsoftware engineer\s*i\b|\bsoftware engineer\s*1\b/i },
  { label: "Associate Software Engineer", pattern: /\bassociate software engineer\b/i },
  { label: "Graduate Software Engineer", pattern: /\bgraduate software engineer\b/i },
  { label: "New Grad Software Engineer", pattern: /\bnew\s*grad\b.*\bsoftware engineer\b|\bsoftware engineer\b.*\bnew\s*grad\b/i },
  { label: "Full Stack Engineer", pattern: /\bfull[- ]?stack engineer\b/i },
  { label: "Frontend Engineer", pattern: /\bfront[- ]?end engineer\b|\bfrontend engineer\b/i },
  { label: "Backend Engineer", pattern: /\bback[- ]?end engineer\b|\bbackend engineer\b/i },
  { label: "Product Engineer", pattern: /\bproduct engineer\b/i },
  { label: "AI Engineer", pattern: /\bai(?:\/ml)? engineer\b|\bml engineer\b/i },
];

/** Good title matches — +22 */
export const GOOD_TITLE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Software Developer", pattern: /\bsoftware developer\b/i },
  { label: "Application Engineer", pattern: /\bapplication engineer\b/i },
  { label: "Web Engineer", pattern: /\bweb engineer\b/i },
  { label: "Platform Engineer", pattern: /\bplatform engineer\b/i },
  { label: "Full Stack Developer", pattern: /\bfull[- ]?stack developer\b/i },
  { label: "Application Developer", pattern: /\bapplication developer\b/i },
  { label: "Web Developer", pattern: /\bweb developer\b/i },
];

/** Low relevance unless strong skills — +8 */
export const LOW_TITLE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "DevOps Engineer", pattern: /\bdevops engineer\b/i },
  { label: "Data Engineer", pattern: /\bdata engineer\b/i },
  { label: "QA Engineer", pattern: /\bqa engineer\b|\bquality assurance engineer\b/i },
  { label: "Test Engineer", pattern: /\btest engineer\b|\bsdet\b/i },
  { label: "Support Engineer", pattern: /\bsupport engineer\b/i },
  { label: "Solutions Engineer", pattern: /\bsolutions? engineer\b/i },
];

/** Hard reject — score 0 */
export const REJECT_TITLE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Product Manager", pattern: /\bproduct manager\b|\bprogram manager\b/i },
  { label: "Data Analyst", pattern: /\bdata analyst\b|\banalyst\b/i },
  { label: "Sales", pattern: /\bsales\b|\baccount executive\b/i },
  { label: "Recruiter", pattern: /\brecruiter\b|\btalent acquisition\b/i },
  { label: "Designer", pattern: /\bdesigner\b|\bux researcher\b/i },
  { label: "Marketing", pattern: /\bmarketing\b|\bgrowth manager\b/i },
];

export const SENIOR_KEYWORDS = [
  "senior",
  "sr.",
  "sr ",
  "staff",
  "principal",
  "lead",
  "manager",
  "director",
  "architect",
  "head of",
  "vp ",
  "vice president",
];

/** Legacy aliases kept for seed/preferences */
export const STRONG_TITLES = EXCELLENT_TITLE_PATTERNS.map((p) => p.label.toLowerCase());
export const MEDIUM_TITLES = GOOD_TITLE_PATTERNS.map((p) => p.label.toLowerCase());

export const STRONG_SKILLS = [
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
];

export const ADDITIONAL_SKILLS = [
  "C",
  "C++",
  "Java",
  "Prisma",
  "OAuth",
  "CI/CD",
  "GitHub Actions",
  "Vercel",
  "Linux",
  "Graph databases",
  "ETL",
  "AI",
  "Machine Learning",
  "LLM",
  "Generative AI",
];

export const RELATED_SKILLS: Record<string, string[]> = {
  React: ["Next.js"],
  "Next.js": ["React"],
  "Node.js": ["Express"],
  TypeScript: [],
  JavaScript: ["TypeScript"],
  Python: ["Machine Learning", "LLM"],
  AI: ["Machine Learning", "LLM", "Generative AI"],
  "Machine Learning": ["AI", "LLM"],
  PostgreSQL: ["SQL"],
  MySQL: ["SQL"],
};

export const PREFERRED_LOCATIONS = [
  "Bangalore",
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi",
  "NCR",
  "Delhi NCR",
  "Gurgaon",
  "Gurugram",
  "Noida",
  "Chennai",
  "Remote India",
  "India",
];

export const DEFAULT_EXCLUDED = [
  "Senior",
  "Staff",
  "Principal",
  "Manager",
  "Director",
  "Architect",
];

export const ROLE_FILTERS = [
  { id: "software-engineer", label: "Software Engineer", pattern: /software engineer|sde\b/i },
  { id: "sde", label: "SDE", pattern: /\bsde\b|software development engineer/i },
  { id: "full-stack", label: "Full Stack", pattern: /full[- ]stack/i },
  { id: "frontend", label: "Frontend", pattern: /front[- ]end|frontend|ui engineer/i },
  { id: "backend", label: "Backend", pattern: /back[- ]end|backend/i },
  { id: "ai-ml", label: "AI/ML", pattern: /\bai\b|\bml\b|machine learning|llm|generative/i },
] as const;
