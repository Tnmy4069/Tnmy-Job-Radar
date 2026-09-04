"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { EmptyHint, PageIntro } from "@/components/app-shell";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobDTO } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { notifyNewJobs } from "@/components/notifications";
import { isIndiaLocation } from "@/lib/location";

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
  blocked?: number;
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
type LoadLog = { id: number; text: string; ok?: boolean };

const LOAD_TIPS = [
  "Official career pages only — no job-board scrapes.",
  "Newest first, so fresh postings rise to the top.",
  "Expand Recommended when you want Gemini to rank fit.",
  "70+ match is the default early-career cut.",
  "Save a role and it stays on this device profile.",
];

const FRESHNESS = [
  { id: "", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "3d", label: "Last 3 days" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

export function JobsList() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [minScore, setMinScore] = useState(70);
  const [experience, setExperience] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("");
  const [tier, setTier] = useState("");
  const [freshness, setFreshness] = useState("");
  const [sort, setSort] = useState("newest");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanCompanies, setScanCompanies] = useState<ScanCompany[]>([]);
  const [scanLatest, setScanLatest] = useState<ScanLatest>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [recommended, setRecommended] = useState<JobDTO[]>([]);
  const [recommendedOpen, setRecommendedOpen] = useState(false);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [recommendedAnalyzing, setRecommendedAnalyzing] = useState(false);
  const [loadPercent, setLoadPercent] = useState(0);
  const [loadLabel, setLoadLabel] = useState("Starting…");
  const [loadLogs, setLoadLogs] = useState<LoadLog[]>([]);
  const logId = useRef(0);

  const pushLog = useCallback((text: string, ok = false) => {
    const id = ++logId.current;
    setLoadLogs((current) => [...current.slice(-7), { id, text, ok }]);
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sort,
      minScore: String(minScore),
      relevant: minScore > 0 ? "true" : "",
    });
    if (qDebounced) params.set("q", qDebounced);
    if (experience) params.set("experience", experience);
    if (location) params.set("location", location);
    if (role) params.set("role", role);
    if (tier) params.set("tier", tier);
    if (freshness) params.set("freshness", freshness);
    if (status) params.set("status", status);
    return params.toString();
  }, [page, qDebounced, minScore, experience, location, role, tier, freshness, sort, status]);

  useEffect(() => {
    const timer = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadPercent(6);
    setLoadLabel("Waking the radar…");
    pushLog("Connecting to Job Radar");

    setLoadPercent(18);
    setLoadLabel("Reading your match stats…");
    pushLog("Fetching relevant / new / saved counts");
    const statsP = fetch("/api/stats")
      .then((r) => r.json())
      .then((statsRes) => {
        setStats(statsRes);
        setLoadPercent((value) => Math.max(value, 46));
        pushLog(`Stats ready · ${statsRes.relevant ?? 0} relevant roles`, true);
        return statsRes;
      })
      .catch(() => {
        pushLog("Stats timed out — continuing with jobs");
        return null;
      });

    setLoadPercent((value) => Math.max(value, 28));
    setLoadLabel("Pulling newest official jobs…");
    pushLog("Loading newest listings from the database");
    const jobsP = fetch(`/api/jobs?${query}`)
      .then((r) => r.json())
      .then((jobsRes) => {
        const rawJobs: JobDTO[] = jobsRes.jobs ?? [];
        const indiaOnly = rawJobs.filter((job) =>
          isIndiaLocation(job.city ?? "", job.country ?? "", job.remoteType, job.location)
        );
        setJobs(indiaOnly);
        setTotal(jobsRes.total ?? indiaOnly.length);
        setLoadPercent((value) => Math.max(value, 84));
        pushLog(`Loaded ${indiaOnly.length} jobs · ${jobsRes.total ?? indiaOnly.length} in this filter`, true);
        return jobsRes;
      })
      .catch(() => {
        pushLog("Job list failed — retry Scan now if this stays empty");
        return null;
      });

    await Promise.all([jobsP, statsP]);
    setLoadPercent(100);
    setLoadLabel("Feed is ready");
    pushLog("Home screen ready — newest first", true);
    setLoading(false);
  }, [query, pushLog]);

  const loadScan = useCallback(async (full = false) => {
    const scanRes = await fetch(full ? "/api/scan/status" : "/api/scan/status?light=1").then((r) => r.json());
    setScanCompanies(scanRes.companies ?? []);
    setScanLatest(scanRes.latest ?? null);
    setScanSummary(scanRes.summary ?? null);
    if (scanRes.running) setScanning(true);
    if (scanRes.latest) {
      pushLog(
        `Last scan · ${scanRes.latest.jobsFound ?? 0} fetched · ${scanRes.latest.jobsRelevant ?? 0} relevant`,
        true
      );
    }
    return scanRes;
  }, [pushLog]);

  const loadRecommended = useCallback(async (analyze = false) => {
    setRecommendedLoading(true);
    const recRes = await fetch(`/api/ai/recommended?limit=12${analyze ? "&analyze=1" : ""}`)
      .then((r) => r.json())
      .catch(() => ({ jobs: [], analyzing: false }));
    const rawRec: JobDTO[] = recRes.jobs ?? [];
    const indiaOnly = rawRec.filter((job) =>
      isIndiaLocation(job.city ?? "", job.country ?? "", job.remoteType, job.location)
    );
    setRecommended(indiaOnly);
    if (analyze) setRecommendedAnalyzing(Boolean(recRes.analyzing));
    else if (!indiaOnly.some((job: JobDTO) => job.aiStatus && job.aiStatus !== "ANALYZED")) {
      setRecommendedAnalyzing(false);
    }
    setRecommendedLoading(false);
    return recRes;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadScan(false);
  }, [loadScan]);

  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(async () => {
      const scanRes = await loadScan(false);
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
  }, [scanning, load, loadScan]);

  useEffect(() => {
    if (!recommendedOpen || !recommendedAnalyzing) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      void loadRecommended(false);
      if (ticks >= 5) {
        setRecommendedAnalyzing(false);
        clearInterval(timer);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [recommendedOpen, recommendedAnalyzing, loadRecommended]);

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
    <div className="flex flex-col lg:flex-row gap-8 pb-12 animate-in fade-in duration-500 pt-6 px-4 sm:px-6 lg:px-8">
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-5 rounded-xl border border-border/80 bg-card/40 p-4 sm:p-5 lg:sticky lg:top-4 lg:h-fit shadow-xs">
        <div>
          <h2 className="text-sm font-semibold tracking-tight mb-3">Search & Filters</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              placeholder="Search roles, skills..."
              className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-border"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Score</label>
            <div className="flex flex-wrap gap-1.5">
              {SCORE_FILTERS.map((item) => (
                <Chip key={item.id} active={minScore === item.value} onClick={() => { setMinScore(item.value); setPage(1); }}>
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Experience</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={experience} onChange={(e) => { setExperience(e.target.value); setPage(1); }}>
              {EXPERIENCE.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
              {LOCATIONS.map((item) => <option key={item} value={item}>{item || "Any Location"}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              {ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Tier</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }}>
              {TIERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Freshness</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={freshness} onChange={(e) => { setFreshness(e.target.value); setPage(1); }}>
              {FRESHNESS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All status</option>
              <option value="saved">Saved</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-muted-foreground">
            {total} jobs found
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <select className="h-8 rounded-md border-none bg-transparent px-2 text-xs font-medium focus:ring-0 outline-none cursor-pointer" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="newest">Newest</option>
              <option value="best">Best match</option>
              <option value="company">Company</option>
              <option value="location">City</option>
              <option value="country">Country</option>
            </select>
          </div>
        </div>

      <section className="mb-6 rounded-xl border border-border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
          onClick={() => {
            const next = !recommendedOpen;
            setRecommendedOpen(next);
            if (next && !recommended.length && !recommendedLoading) {
              void loadRecommended(true);
            }
          }}
        >
          <span>Recommended for you</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", recommendedOpen && "rotate-180")} />
        </button>
        {recommendedOpen ? (
          <div className="border-t border-border px-4 py-3">
            {recommendedLoading && !recommended.length ? (
              <p className="text-xs text-muted-foreground">Loading recommendations…</p>
            ) : recommended.length === 0 ? (
              <p className="text-xs text-muted-foreground">No AI recommendations yet.</p>
            ) : (
              <div className="grid gap-3">
                {recommendedAnalyzing ? (
                  <p className="text-xs text-muted-foreground">Gemini is scoring these roles…</p>
                ) : null}
                {recommended.slice(0, 8).map((job) => (
                  <JobCard key={`rec-${job.id}`} job={job} onSave={saveJob} onStatus={updateStatus} />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {scanLatest || scanSummary || scanning ? (
        <details
          className="mb-5 rounded-lg border border-border bg-card px-3 py-2 text-xs"
          open={scanning}
          onToggle={(event) => {
            if ((event.target as HTMLDetailsElement).open && scanCompanies.length === 0) {
              void loadScan(true);
            }
          }}
        >
          <summary className="cursor-pointer text-muted-foreground">
            Last scan status
            {scanLatest?.durationMs != null ? ` · ${formatDuration(scanLatest.durationMs)}` : ""}
          </summary>
          {scanSummary || scanLatest ? (
            <p className="mt-2 text-muted-foreground">
              Companies: {scanSummary?.enabledTotal ?? scanLatest?.companies ?? 0} enabled ·{" "}
              {scanLatest?.okCount ?? scanSummary?.ok ?? 0} ok ·{" "}
              {scanLatest?.failedCount ?? scanSummary?.failed ?? 0} failed ·{" "}
              {scanLatest?.unsupportedCount ?? scanSummary?.unsupported ?? 0} unsupported ·{" "}
              {scanSummary?.blocked ?? 0} blocked
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
        <HomeLoadPanel percent={loadPercent} label={loadLabel} logs={loadLogs} />
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
      </main>
    </div>
  );
}

function HomeLoadPanel({
  percent,
  label,
  logs,
}: {
  percent: number;
  label: string;
  logs: LoadLog[];
}) {
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTipIndex((value) => (value + 1) % LOAD_TIPS.length), 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Loading feed</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{Math.min(100, percent)}%</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <p className="max-w-[14rem] text-right text-xs text-muted-foreground">{LOAD_TIPS[tipIndex]}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <ul className="mt-4 max-h-44 space-y-1.5 overflow-auto font-mono text-xs text-muted-foreground">
        {logs.map((log) => (
          <li key={log.id} className="flex gap-2">
            <span className={log.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
              {log.ok ? "✓" : "›"}
            </span>
            <span>{log.text}</span>
          </li>
        ))}
      </ul>
    </section>
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
  if (status === "blocked") return "×";
  if (status === "unsupported") return "○";
  return "·";
}
