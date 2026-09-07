"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/use-auth";

type Prefs = {
  targetTitles: string[];
  targetLocations: string[];
  targetSkills: string[];
  experienceLevel: string;
};

export function OnboardingWizard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      if (!loading) router.push("/login");
      return;
    }
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => setPrefs(data.preferences))
      .catch(() => null);
  }, [user, loading, router]);

  async function completeOnboarding() {
    if (!prefs || saving) return;
    setSaving(true);
    try {
      // First, get the full preferences to not overwrite other fields
      const res = await fetch("/api/preferences");
      const current = await res.json();
      
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current.preferences, ...prefs }),
      });
      
      // Set a cookie so the server knows onboarding is complete
      document.cookie = "jr_onboarded=1; path=/; max-age=31536000";
      
      // Force a hard refresh to go to dashboard
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setSaving(false);
    }
  }

  if (loading || !prefs) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-2xl glass-card rounded-2xl p-5 sm:p-8 md:p-12">
        <div className="flex items-center gap-2 mb-6 sm:mb-8">
          <Radar className="h-6 w-6 text-accent" />
          <span className="text-lg font-bold tracking-tight">Job Radar</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3">Complete your profile</h1>
        <p className="text-muted-foreground text-base sm:text-lg mb-6 sm:mb-8">
          Let&apos;s tailor the AI to find your perfect role.
        </p>

        <div className="space-y-6">
          <Field label="What roles are you looking for?">
            <TagInput
              values={prefs.targetTitles}
              onChange={(targetTitles) => setPrefs({ ...prefs, targetTitles })}
              placeholder="Software Engineer, SDE, Frontend..."
            />
          </Field>

          <Field label="Where do you want to work?">
            <TagInput
              values={prefs.targetLocations}
              onChange={(targetLocations) => setPrefs({ ...prefs, targetLocations })}
              placeholder="Bangalore, Hyderabad, Remote..."
            />
          </Field>

          <Field label="What are your core skills?">
            <TagInput
              values={prefs.targetSkills}
              onChange={(targetSkills) => setPrefs({ ...prefs, targetSkills })}
              placeholder="TypeScript, React, Node.js..."
            />
          </Field>

          <Field label="Your experience level">
            <select
              className="h-11 w-full rounded-md border border-border bg-muted/50 px-3 text-sm focus:bg-background focus:border-accent outline-none transition-colors"
              value={prefs.experienceLevel}
              onChange={(e) => setPrefs({ ...prefs, experienceLevel: e.target.value })}
            >
              <option value="new-grad">New grad</option>
              <option value="0-2">0–2 years</option>
              <option value="2-3">2–3 years</option>
              <option value="any">Any</option>
            </select>
          </Field>
        </div>

        <div className="mt-8 sm:mt-10 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground text-center sm:text-left">You can change these later in settings.</p>
          <Button
            size="lg"
            className="rounded-full px-8 w-full sm:w-auto shrink-0"
            onClick={completeOnboarding}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      {children}
    </div>
  );
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw = draft) {
    const parts = raw
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!parts.length) {
      setDraft("");
      return;
    }
    const next = [...values];
    for (const part of parts) {
      if (!next.some((item) => item.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-2 focus-within:bg-background focus-within:border-accent transition-colors">
      {values.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2.5 py-1 text-xs font-medium shadow-sm"
        >
          {item}
          <button
            type="button"
            className="text-accent-foreground/70 hover:text-accent-foreground"
            onClick={() => onChange(values.filter((value) => value !== item))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={draft}
        placeholder={values.length ? "Add another…" : placeholder}
        onChange={(event) => {
          const value = event.target.value;
          if (/[,;]/.test(value)) commit(value);
          else setDraft(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit()}
      />
    </div>
  );
}
