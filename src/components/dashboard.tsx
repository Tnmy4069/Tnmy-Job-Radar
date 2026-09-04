"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { EmptyHint, PageIntro } from "@/components/app-shell";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobDTO } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { notifyNewJobs } from "@/components/notifications";

type Stats = {
  relevant: number;
  newToday: number;
  excellent: number;
  saved: number;
  applied: number;
};

type ScanCompany = {
  name: string;
  slug: string;
  checkStatus: string;
  lastCheckedAt: string | null;
  lastError: string | null;
};

type ScanLatest = {
  durationMs?: number | null;
  jobsFound?: number;
  jobsNew?: number;
  jobsRelevant?: number;
  okCount?: number;
  failedCount?: number;
  unsupportedCount?: number;
  companies?: number;
  status?: string;
} | null;

type ScanSummary = {
  enabledTotal: number;
  ok: number;
  failed: number;
  unsupported: number;
  idle: number;
};

const SCORE_FILTERS = [
  { id: "90", label: "90+", value: 90 },
  { id: "80", label: "80+", value: 80 },
  { id: "70", label: "70+", value: 70 },
  { id: "all", label: "All", value: 0 },
];

const EXPERIENCE = [
  { id: "", label: "Any" },
  { id: "new-grad", label: "New Grad" },
  { id: "0-2", label: "0–2 years" },
  { id: "2-3", label: "2–3 years" },
];

const LOCATIONS = ["", "bangalore", "hyderabad", "pune", "mumbai", "ncr", "chennai", "remote"];
const ROLES = [
  { id: "", label: "All roles" },
  { id: "software-engineer", label: "Software Engineer" },
  { id: "sde", label: "SDE" },
  { id: "full-stack", label: "Full Stack" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "ai-ml", label: "AI/ML" },
];
const TIERS = [
  { id: "", label: "All companies" },
  { id: "tier-1", label: "Tier 1" },
  { id: "indian", label: "Indian Product" },
  { id: "saas", label: "SaaS" },
  { id: "ai", label: "AI" },
];
const FRESHNESS = [
  { id: "", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "3d", label: "Last 3 days" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(70);
  const [experience, setExperience] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("");
  const [tier, setTier] = useState("");
  const [freshness, setFreshness] = useState("");
  const [sort, setSort] = useState("best");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanCompanies, setScanCompanies] = useState<ScanCompany[]>([]);
  const [scanLatest, setScanLatest] = useState<ScanLatest>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sort,
      minScore: String(minScore),
      relevant: minScore > 0 ? "true" : "",
    });
    if (q) params.set("q", q);
    if (experience) params.set("experience", experience);
    if (location) params.set("location", location);
    if (role) params.set("role", role);
    if (tier) params.set("tier", tier);
    if (freshness) params.set("freshness", freshness);
    if (status) params.set("status", status);
    return params.toString();
  }, [page, q, minScore, experience, location, role, tier, freshness, sort, status]);

  const load = useCallback(async () => {
    setLoading(true);
    const [jobsRes, statsRes, scanRes] = await Promise.all([
      fetch(`/api/jobs?${query}`).then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/scan/status").then((r) => r.json()),
    ]);
    setJobs(jobsRes.jobs ?? []);
    setTotal(jobsRes.total ?? 0);
    setStats(statsRes);
    setScanCompanies(scanRes.companies ?? []);
    setScanLatest(scanRes.latest ?? null);
    setScanSummary(scanRes.summary ?? null);
    if (scanRes.running) setScanning(true);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(async () => {
      const scanRes = await fetch("/api/scan/status").then((r) => r.json());
      setScanCompanies(scanRes.companies ?? []);
      setScanLatest(scanRes.latest ?? null);
      setScanSummary(scanRes.summary ?? null);
      if (!scanRes.running) {
        clearInterval(timer);
        setScanning(false);
        const latest = scanRes.latest;
        setScanMessage(
          latest
            ? `Scan complete · ${latest.jobsFound ?? 0} fetched · ${latest.jobsNew ?? 0} new · ${latest.jobsRelevant ?? 0} relevant · ${formatDuration(latest.durationMs)}`
            : "Scan complete"
        );
        await load();
        if ((latest?.jobsNew ?? 0) > 0) notifyNewJobs(latest.jobsNew);
      } else {
        setScanMessage("Scanning official career pages…");
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [scanning, load]);

  async function updateStatus(id: string, next: string) {
    await fetch(`/api/jobs/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, userStatus: next, isNew: false } : job)));
  }

  async function saveJob(id: string) {
    const res = await fetch(`/api/jobs/${id}/save`, { method: "POST" }).then((r) => r.json());
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, userStatus: res.userStatus, isNew: false } : job))
    );
  }

  async function scanNow() {
    if (scanning) return;
    setScanning(true);
    setScanMessage("Starting scan…");
    const res = await fetch("/api/scan", { method: "POST" }).then((r) => r.json());
    if (!res.ok && !res.running) {
      setScanMessage(res.message ?? "Scan failed");
      setScanning(false);
      return;
    }
    setScanMessage("Scanning official career pages…");
  }

  return (
    <div>
      <PageIntro
        eyebrow="Job Radar"
        title="Early-career roles from product companies"
        description="Official career pages only. Ranked for a 0–2 year software engineering profile."
        action={
          <Button onClick={scanNow} disabled={scanning}>
            <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} />
            {scanning ? "Scanning" : "Scan now"}
          </Button>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Relevant jobs" value={stats?.relevant ?? 0} />
        <Stat label="New today" value={stats?.newToday ?? 0} />
        <Stat label="Excellent matches" value={stats?.excellent ?? 0} />
        <Stat label="Saved" value={stats?.saved ?? 0} />
        <Stat label="Applied" value={stats?.applied ?? 0} />
      </section>

      {scanMessage ? <p className="mb-4 text-xs text-muted-foreground">{scanMessage}</p> : null}

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
            placeholder="Search react typescript, software engineer bangalore, nextjs…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SCORE_FILTERS.map((item) => (
            <Chip key={item.id} active={minScore === item.value} onClick={() => { setMinScore(item.value); setPage(1); }}>
              {item.label}
            </Chip>
          ))}
          <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" value={experience} onChange={(e) => { setExperience(e.target.value); setPage(1); }}>
            {EXPERIENCE.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
            {LOCATIONS.map((item) => <option key={item} value={item}>{item || "Location"}</option>)}
          </select>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            {ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }}>
            {TIERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" value={freshness} onChange={(e) => { setFreshness(e.target.value); setPage(1); }}>
            {FRESHNESS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="best">Best match</option>
            <option value="newest">Newest</option>
            <option value="company">Company</option>
            <option value="location">City</option>
            <option value="country">Country</option>
          </select>
          <select className="h-8 rounded-md border border-border bg-card px-2 text-xs" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All status</option>
            <option value="saved">Saved</option>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {scanCompanies.length ? (
        <details className="mb-5 rounded-lg border border-border bg-card px-3 py-2 text-xs" open={scanning}>
          <summary className="cursor-pointer text-muted-foreground">
            Last scan status
            {scanLatest?.durationMs != null ? ` · ${formatDuration(scanLatest.durationMs)}` : ""}
          </summary>
          {scanSummary || scanLatest ? (
            <p className="mt-2 text-muted-foreground">
              Companies: {scanSummary?.enabledTotal ?? scanLatest?.companies ?? 0} enabled ·{" "}
              {scanLatest?.okCount ?? scanSummary?.ok ?? 0} ok ·{" "}
              {scanLatest?.failedCount ?? scanSummary?.failed ?? 0} failed ·{" "}
              {scanLatest?.unsupportedCount ?? scanSummary?.unsupported ?? 0} unsupported
              {scanLatest ? (
                <>
                  {" "}
                  · Jobs: {scanLatest.jobsFound ?? 0} fetched · {scanLatest.jobsNew ?? 0} new ·{" "}
                  {scanLatest.jobsRelevant ?? 0} relevant
                </>
              ) : null}
            </p>
          ) : null}
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {scanCompanies.map((company) => (
              <li key={company.slug} className="flex items-center justify-between gap-3">
                <span>{company.name}</span>
                <span className="text-muted-foreground">
                  {statusGlyph(company.checkStatus)} {company.checkStatus}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyHint
          title="No matching jobs yet"
          body="Run Scan now to pull live openings from official career pages. Companies without a public ATS stay marked Unsupported instead of inventing results."
        />
      ) : (
        <div className="grid gap-3">
          {(sort === "country" || sort === "location" ? groupedJobs(jobs, sort) : [{ label: "", items: jobs }]).map((group) => (
            <div key={group.label || "all"} className="grid gap-3">
              {group.label ? (
                <h2 className="pt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </h2>
              ) : null}
              {group.items.map((job) => (
                <JobCard key={job.id} job={job} onSave={saveJob} onStatus={updateStatus} />
              ))}
            </div>
          ))}
        </div>
      )}

      {total > 20 ? (
        <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} jobs · page {page}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 rounded-md border px-2.5 text-xs",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function groupedJobs(jobs: JobDTO[], sort: string) {
  const groups: { label: string; items: JobDTO[] }[] = [];
  for (const job of jobs) {
    const label =
      sort === "country"
        ? job.country || "Unknown country"
        : job.city || job.location || "Unknown city";
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.items.push(job);
    else groups.push({ label, items: [job] });
  }
  return groups;
}

function statusGlyph(status: string) {
  if (status === "ok") return "✓";
  if (status === "failed") return "⚠";
  if (status === "unsupported") return "○";
  return "·";
}
