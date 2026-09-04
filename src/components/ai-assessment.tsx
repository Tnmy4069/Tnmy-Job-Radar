"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recommendationGlyph, recommendationLabel } from "@/lib/ai/priority";

type AnalysisPayload = {
  fitScore: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  concerns: string[];
  reasoning: string;
  experienceFit: string;
  skillFit: string;
  roleFit: string;
  locationFit: string;
  requiredSkillsMatched: string[];
  requiredSkillsMissing: string[];
  preferredSkillsMatched: string[];
  preferredSkillsMissing: string[];
  seniority: string;
};

export function AiAssessment({
  jobId,
  relevanceScore,
  initial,
  status,
}: {
  jobId: string;
  relevanceScore: number;
  initial: AnalysisPayload | null;
  status: string;
}) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(initial);
  const [aiStatus, setAiStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cacheHit, setCacheHit] = useState(false);

  async function analyze(force = false) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/ai/analyze/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.analysis) {
      setAnalysis(data.analysis);
      setAiStatus("ANALYZED");
      setCacheHit(Boolean(data.cacheHit));
      router.refresh();
      return;
    }
    setError(data.error || data.skipped || data.message || "Analysis unavailable");
    if (data.skipped === "disabled") setError("Gemini is disabled or the API key is missing.");
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">AI Assessment</p>
          {analysis ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold">{analysis.fitScore}% Fit</span>
              <span className="text-sm">
                {recommendationGlyph(analysis.recommendation)} {recommendationLabel(analysis.recommendation)}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {aiStatus === "FAILED" ? "Previous analysis failed." : "Not analyzed yet."}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => analyze(Boolean(analysis))}>
          {loading ? "Analyzing…" : analysis ? "Re-analyze" : "AI Analyze"}
        </Button>
      </div>
      {cacheHit ? <p className="mt-2 text-xs text-muted-foreground">Cached analysis reused.</p> : null}
      {error ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}

      {analysis ? (
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-muted-foreground">{analysis.summary}</p>
          {analysis.strengths.length ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Strengths</p>
              <ul className="mt-1 grid gap-1">
                {analysis.strengths.map((item) => (
                  <li key={item}>✓ {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {analysis.gaps.length ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gaps</p>
              <ul className="mt-1 grid gap-1 text-muted-foreground">
                {analysis.gaps.map((item) => (
                  <li key={item}>⚠ {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <Fit label="Experience" value={analysis.experienceFit} />
            <Fit label="Role" value={analysis.roleFit} />
            <Fit label="Skills" value={analysis.skillFit} />
            <Fit label="Location" value={analysis.locationFit} />
          </div>
          <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Why this job?</p>
            <p className="mt-2">Deterministic score: {relevanceScore}</p>
            <p>AI score: {analysis.fitScore}</p>
            <p className="mt-2">{analysis.reasoning}</p>
            {analysis.requiredSkillsMissing.length ? (
              <p className="mt-2">Required missing: {analysis.requiredSkillsMissing.join(", ")}</p>
            ) : null}
            {analysis.preferredSkillsMissing.length ? (
              <p>Preferred missing: {analysis.preferredSkillsMissing.join(", ")}</p>
            ) : null}
            <p className="mt-2 capitalize">Seniority: {analysis.seniority}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Fit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="capitalize">{value}</div>
    </div>
  );
}
