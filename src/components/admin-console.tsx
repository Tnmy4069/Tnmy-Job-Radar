"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/use-auth";
import type { CompanyCoverage, CompanyDTO } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

type Stats = {
  relevant: number;
  newToday: number;
  excellent: number;
  saved: number;
  applied: number;
};

type GeminiStatus = {
  enabled: boolean;
  model: string;
  minScore: number;
  queue: number;
  analyzed: number;
  failed: number;
  workers: { current: number; limit: number; quotaPaused: boolean; circuit: string };
  metrics: {
    successes: number;
    cacheHits: number;
    rateLimits: number;
    retries: number;
    averageLatencyMs: number;
  };
};

type ScanCompany = {
  name: string;
  slug: string;
  checkStatus: string;
  lastError: string | null;
  lastBlockReason?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  failureCount?: number;
  blockedCount?: number;
  rateLimitCount?: number;
  jobsFetched?: number;
  jobsParsed?: number;
  jobsRejected?: number;
  averageLatencyMs?: number;
  sourceType?: string;
  sourceStatus?: string;
  consecutiveFailures?: number;
  sourceNotes?: string;
};

export function AdminConsole() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sources, setSources] = useState<ScanCompany[]>([]);
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [coverage, setCoverage] = useState<CompanyCoverage | null>(null);
  const [companyRows, setCompanyRows] = useState<CompanyDTO[]>([]);
  const [gemini, setGemini] = useState<GeminiStatus | null>(null);

  async function load() {
    const [usersRes, statsRes, scanRes, companyRes, geminiRes] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/scan/status").then((r) => r.json()),
      fetch("/api/companies").then((r) => r.json()),
      fetch("/api/ai/status").then((r) => r.json()),
    ]);
    setUsers(usersRes.users ?? []);
    setStats(statsRes);
    setSources(scanRes.companies ?? []);
    setCoverage(companyRes.coverage ?? null);
    setCompanyRows(companyRes.companies ?? []);
    if (geminiRes && !geminiRes.error) setGemini(geminiRes);
  }

  useEffect(() => {
    if (user?.role === "superadmin") void load();
  }, [user]);

  async function scanNow() {
    setScanning(true);
    setMessage("Starting scan…");
    const res = await fetch("/api/scan", { method: "POST" }).then((r) => r.json());
    if (!res.ok && !res.running) {
      setMessage(res.message ?? "Scan failed");
      setScanning(false);
      return;
    }
    const timer = setInterval(async () => {
      const status = await fetch("/api/scan/status").then((r) => r.json());
      if (!status.running) {
        clearInterval(timer);
        setScanning(false);
        setMessage("Scan complete");
        await load();
      }
    }, 2000);
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!user || user.role !== "superadmin") return <AuthForm mode="login" admin />;

  return (
    <div>
      <PageIntro
        eyebrow="Superadmin"
        title="Control plane"
        description={`Signed in as ${user.email}. Manage candidates, scans, and system matching.`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={verifying || scanning}
              onClick={async () => {
                setVerifying(true);
                setMessage("Verifying official sources…");
                const res = await fetch("/api/companies/verify", { method: "POST" }).then((r) => r.json());
                setVerifying(false);
                setMessage(
                  res.ok
                    ? `Verified ${res.verified} · unsupported ${res.unsupported} · failed ${res.failed}`
                    : res.message ?? "Verify failed"
                );
                await load();
              }}
            >
              {verifying ? "Verifying…" : "Verify sources"}
            </Button>
            <Button onClick={scanNow} disabled={scanning || verifying}>
              {scanning ? "Scanning…" : "Scan now"}
            </Button>
          </div>
        }
      />
      {message ? <p className="mb-4 text-xs text-muted-foreground">{message}</p> : null}

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Candidates" value={users.filter((item) => item.role === "candidate").length} />
        <Stat label="Relevant jobs" value={stats?.relevant ?? 0} />
        <Stat label="New today" value={stats?.newToday ?? 0} />
        <Stat label="Excellent" value={stats?.excellent ?? 0} />
        <Stat label="Admins" value={users.filter((item) => item.role === "superadmin").length} />
      </section>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/settings" className="rounded-md border border-border px-3 py-1.5">
          System matching profile
        </Link>
        <Link href="/companies" className="rounded-md border border-border px-3 py-1.5">
          Companies
        </Link>
        <Link href="/" className="rounded-md border border-border px-3 py-1.5">
          Job feed
        </Link>
      </div>

      {coverage ? (
        <p className="mb-6 text-xs text-muted-foreground">
          Tracked {coverage.tracked} · Verified {coverage.verified} · Unverified {coverage.unverified} ·
          Unsupported {coverage.unsupported} · Failed {coverage.failed}
        </p>
      ) : null}

      {gemini ? (
        <section className="mb-6 rounded-xl border border-border p-4 text-xs">
          <p className="font-medium">Gemini</p>
          <p className="mt-2 text-muted-foreground">
            Queue: {gemini.queue} · Workers: {gemini.workers.current}/{gemini.workers.limit} · Success:{" "}
            {gemini.metrics.successes} · Cache hits: {gemini.metrics.cacheHits} · 429s:{" "}
            {gemini.metrics.rateLimits} · Retries: {gemini.metrics.retries} · Avg latency:{" "}
            {gemini.metrics.averageLatencyMs}ms
          </p>
          <p className="mt-1 text-muted-foreground">
            Model: {gemini.model} · Threshold: {gemini.minScore} · Analyzed: {gemini.analyzed} · Failed:{" "}
            {gemini.failed} · Circuit: {gemini.workers.circuit}
            {gemini.workers.quotaPaused ? " · quota paused" : ""}
          </p>
        </section>
      ) : null}

      <h2 className="mb-3 text-sm font-medium">Source health</h2>
      <div className="mb-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Fetched / parsed / rejected</th>
              <th className="px-3 py-2 font-medium">Blocks</th>
              <th className="px-3 py-2 font-medium">Last error</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((company) => (
              <tr key={company.slug} className="border-t border-border">
                <td className="px-3 py-2">
                  {company.name}
                  <div className="text-muted-foreground">{company.sourceType}</div>
                </td>
                <td className="px-3 py-2 capitalize">
                  {company.sourceStatus ?? company.checkStatus}
                  {company.consecutiveFailures ? ` · ${company.consecutiveFailures} fails` : ""}
                </td>
                <td className="px-3 py-2">
                  {company.jobsFetched ?? 0} / {company.jobsParsed ?? 0} / {company.jobsRejected ?? 0}
                </td>
                <td className="px-3 py-2">
                  {company.blockedCount ?? 0}
                  {company.lastBlockReason ? ` · ${company.lastBlockReason}` : ""}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">
                  {company.lastError || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 grid gap-4 text-xs md:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <p className="font-medium">Unsupported</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-muted-foreground">
            {companyRows
              .filter((row) => row.sourceStatus === "UNSUPPORTED")
              .map((row) => (
                <li key={row.slug}>
                  {row.name} — {row.sourceNotes || "Current adapter unsupported"}
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="font-medium">Failed sources</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-muted-foreground">
            {companyRows
              .filter((row) => row.sourceStatus === "FAILED")
              .map((row) => (
                <li key={row.slug}>
                  {row.name} — {row.lastError || "failed"} · {row.consecutiveFailures ?? 0} failures
                </li>
              ))}
          </ul>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-medium">Accounts</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2">{item.name || "—"}</td>
                <td className="px-3 py-2">{item.email}</td>
                <td className="px-3 py-2 capitalize">{item.role}</td>
                <td className="px-3 py-2 text-muted-foreground">{timeAgo(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
