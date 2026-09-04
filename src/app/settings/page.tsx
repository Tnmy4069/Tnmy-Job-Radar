"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    void fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => setPrefs(data.preferences));
  }, []);

  async function save() {
    if (!prefs) return;
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaved("Preferences saved");
  }

  function requestNotifications() {
    if (!("Notification" in window)) return;
    void Notification.requestPermission();
  }

  if (!prefs) return <div className="text-sm text-muted-foreground">Loading settings…</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageIntro
        eyebrow="Settings"
        title="Matching profile"
        description="These values drive relevance scoring, filters, and scan cadence."
      />

      <Field label="Target roles">
        <Input
          value={prefs.targetTitles.join(", ")}
          onChange={(e) => setPrefs({ ...prefs, targetTitles: splitList(e.target.value) })}
        />
      </Field>
      <Field label="Locations">
        <Input
          value={prefs.targetLocations.join(", ")}
          onChange={(e) => setPrefs({ ...prefs, targetLocations: splitList(e.target.value) })}
        />
      </Field>
      <Field label="Strong skills">
        <Input
          value={prefs.targetSkills.join(", ")}
          onChange={(e) => setPrefs({ ...prefs, targetSkills: splitList(e.target.value) })}
        />
      </Field>
      <Field label="Excluded keywords">
        <Input
          value={prefs.excludedKeywords.join(", ")}
          onChange={(e) => setPrefs({ ...prefs, excludedKeywords: splitList(e.target.value) })}
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
        <Field label="Notify when score ≥">
          <Input
            type="number"
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
        <Button onClick={save}>Save preferences</Button>
        <Button variant="outline" onClick={requestNotifications}>
          Enable browser notifications
        </Button>
      </div>
      {saved ? <p className="mt-3 text-xs text-muted-foreground">{saved}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
