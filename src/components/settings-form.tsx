"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/use-auth";

type Prefs = {
  targetTitles: string[];
  targetLocations: string[];
  targetSkills: string[];
  additionalSkills: string[];
  excludedKeywords: string[];
  minimumRelevanceScore: number;
  scanFrequency: string;
  includeSeniorRoles: boolean;
  allowInternational: boolean;
  notifyMinScore: number;
  remotePreference: string;
  experienceLevel: string;
};

export function SettingsForm() {
  const { user, loading } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.role === "superadmin";

  useEffect(() => {
    if (!user) return;
    void fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => setPrefs(data.preferences))
      .catch(() => setStatus("Could not load settings"));
  }, [user]);

  async function save() {
    if (!prefs || saving) return;
    setSaving(true);
    setStatus(isAdmin ? "Saving and updating match scores…" : "Saving…");
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(data?.error ?? "Could not save preferences");
        return;
      }
      if (data?.preferences) setPrefs(data.preferences);
      setStatus(isAdmin ? "Preferences saved. Matching scores updated." : "Preferences saved.");
    } catch {
      setStatus("Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  function requestNotifications() {
    if (!("Notification" in window)) return;
    void Notification.requestPermission();
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading settings…</div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Sign in to edit your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Matching roles, skills, and locations are saved on your candidate account.
        </p>
        <div className="mt-4 flex gap-2">
          <a href="/login">
            <Button>Sign in</Button>
          </a>
          <a href="/register">
            <Button variant="outline">Create account</Button>
          </a>
        </div>
      </div>
    );
  }

  if (!prefs) return <div className="text-sm text-muted-foreground">{status || "Loading settings…"}</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageIntro
        eyebrow="Settings"
        title="Matching profile"
        description="These values drive relevance scoring, filters, and scan cadence. Type a value and press Enter or comma to add it."
      />

      <Field label="Target roles">
        <TagInput
          values={prefs.targetTitles}
          onChange={(targetTitles) => setPrefs({ ...prefs, targetTitles })}
          placeholder="Software Engineer, SDE, Frontend…"
        />
      </Field>
      <Field label="Locations">
        <TagInput
          values={prefs.targetLocations}
          onChange={(targetLocations) => setPrefs({ ...prefs, targetLocations })}
          placeholder="Bangalore, Hyderabad, Remote India…"
        />
      </Field>
      <Field label="Strong skills">
        <TagInput
          values={prefs.targetSkills}
          onChange={(targetSkills) => setPrefs({ ...prefs, targetSkills })}
          placeholder="TypeScript, React, Node.js…"
        />
      </Field>
      <Field label="Additional skills">
        <TagInput
          values={prefs.additionalSkills}
          onChange={(additionalSkills) => setPrefs({ ...prefs, additionalSkills })}
          placeholder="Python, Docker, AWS…"
        />
      </Field>
      <Field label="Excluded keywords">
        <TagInput
          values={prefs.excludedKeywords}
          onChange={(excludedKeywords) => setPrefs({ ...prefs, excludedKeywords })}
          placeholder="Senior, Manager, Intern…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum score">
          <select
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={prefs.minimumRelevanceScore}
            onChange={(e) => setPrefs({ ...prefs, minimumRelevanceScore: Number(e.target.value) })}
          >
            <option value={70}>70</option>
            <option value={80}>80</option>
            <option value={90}>90</option>
          </select>
        </Field>
        {isAdmin ? (
          <Field label="Scan frequency">
            <select
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={prefs.scanFrequency}
              onChange={(e) => setPrefs({ ...prefs, scanFrequency: e.target.value })}
            >
              <option value="manual">Manual</option>
              <option value="6h">Every 6 hours</option>
              <option value="12h">Every 12 hours</option>
              <option value="daily">Daily</option>
            </select>
          </Field>
        ) : null}
        <Field label="Remote preference">
          <select
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={prefs.remotePreference}
            onChange={(e) => setPrefs({ ...prefs, remotePreference: e.target.value })}
          >
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </Field>
        <Field label="Experience level">
          <select
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={prefs.experienceLevel}
            onChange={(e) => setPrefs({ ...prefs, experienceLevel: e.target.value })}
          >
            <option value="new-grad">New grad</option>
            <option value="0-2">0–2 years</option>
            <option value="2-3">2–3 years</option>
            <option value="any">Any</option>
          </select>
        </Field>
        <Field label="Notify when score ≥">
          <Input
            type="number"
            min={0}
            max={100}
            value={prefs.notifyMinScore}
            onChange={(e) => setPrefs({ ...prefs, notifyMinScore: Number(e.target.value) })}
          />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prefs.includeSeniorRoles}
          onChange={(e) => setPrefs({ ...prefs, includeSeniorRoles: e.target.checked })}
        />
        Include senior / staff / principal roles
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prefs.allowInternational}
          onChange={(e) => setPrefs({ ...prefs, allowInternational: e.target.checked })}
        />
        Allow non-India locations
      </label>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
        <Button variant="outline" onClick={requestNotifications}>
          Enable browser notifications
        </Button>
      </div>
      {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
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
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {values.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
        >
          {item}
          <button
            type="button"
            aria-label={`Remove ${item}`}
            className="text-muted-foreground hover:text-foreground"
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
