"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/use-auth";
import type { CompanyCoverage, CompanyDTO } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export function CompaniesList() {
  const { user } = useAuth();
  const isAdmin = user?.role === "superadmin";
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  const [coverage, setCoverage] = useState<CompanyCoverage | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [careersUrl, setCareersUrl] = useState("");

  async function load() {
    const data = await fetch("/api/companies").then((r) => r.json());
    setCompanies(data.companies ?? []);
    setCoverage(data.coverage ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  const verified = companies.filter((row) => row.sourceStatus === "VERIFIED");
  const unsupported = companies.filter((row) => row.sourceStatus === "UNSUPPORTED");
  const failed = companies.filter((row) => row.sourceStatus === "FAILED");
  const atsEntries = Object.entries(coverage?.ats ?? {}).sort((a, b) => b[1] - a[1]);

  async function verifyAll() {
    setBusy(true);
    setMessage("Verifying unverified official sources…");
    const res = await fetch("/api/companies/verify", { method: "POST" }).then((r) => r.json());
    setMessage(
      res.ok
        ? `Verified ${res.verified} · unsupported ${res.unsupported} · failed ${res.failed}`
        : res.message ?? "Verify failed"
    );
    setBusy(false);
    await load();
  }

  async function addCompany(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, careersUrl }),
    }).then((r) => r.json());
    setBusy(false);
    if (res.company) {
      setName("");
      setCareersUrl("");
      setMessage(`Added ${res.company.name} as UNVERIFIED`);
      await load();
      return;
    }
    setMessage(res.error ?? "Could not add company");
  }

  return (
    <div>
      <PageIntro
        eyebrow="Companies"
        title="Official sources"
        description="Official company and ATS career sources only. Job Radar does not use third-party job aggregators."
        action={
          isAdmin ? (
            <Button variant="outline" onClick={verifyAll} disabled={busy}>
              {busy ? "Working…" : "Verify sources"}
            </Button>
          ) : undefined
        }
      />
      {coverage ? (
        <div className="mb-5 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Company coverage</p>
          <p className="mt-1 break-words leading-relaxed">
            Tracked: {coverage.tracked} · Verified: {coverage.verified} · Unverified: {coverage.unverified} ·
            Unsupported: {coverage.unsupported} · Failed: {coverage.failed} · Disabled: {coverage.disabled}
          </p>
          {atsEntries.length ? (
            <p className="mt-1">
              ATS:{" "}
              {atsEntries
                .map(([type, count]) => `${type}: ${count}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="mb-4 text-xs text-muted-foreground">{message}</p> : null}
      {isAdmin ? (
        <form onSubmit={addCompany} className="mb-5 grid gap-2 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_auto]">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Company name" required />
          <Input
            value={careersUrl}
            onChange={(event) => setCareersUrl(event.target.value)}
            placeholder="Official careers URL"
            required
          />
          <Button type="submit" disabled={busy}>
            Add company
          </Button>
        </form>
      ) : null}
      <details className="mb-5 rounded-xl border border-border bg-card px-4 py-3 text-xs">
        <summary className="cursor-pointer font-medium">Verified / unsupported / failed reports</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Report title="Verified" rows={verified.map((row) => `${row.name} — ${row.sourceType} · jobs ${row.jobsFetched ?? 0} · last ${timeAgo(row.sourceVerifiedAt ?? row.lastSuccessAt)}`)} />
          <Report
            title="Unsupported"
            rows={unsupported.map((row) => `${row.name} — ${row.sourceNotes || row.lastError || "adapter unsupported"} · ${timeAgo(row.lastCheckedAt)}`)}
          />
          <Report
            title="Failed"
            rows={failed.map(
              (row) =>
                `${row.name} — failures ${row.consecutiveFailures ?? row.failureCount ?? 0} · ${row.lastError || "failed"} · last success ${timeAgo(row.lastSuccessAt)}`
            )}
          />
        </div>
      </details>
      <div className="grid gap-3 md:grid-cols-2">
        {companies.map((company) => (
          <Link
            key={company.id}
            href={`/companies/${company.slug}`}
            className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {company.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logo} alt="" className="h-5 w-5 rounded-sm" />
                ) : null}
                <h2 className="text-sm font-medium">{company.name}</h2>
              </div>
              <Badge className="capitalize">{company.sourceStatus ?? company.checkStatus}</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {company.relevant} relevant · {company.isNew} new · {company.jobsFound} stored
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last checked {timeAgo(company.lastCheckedAt)} · {company.sourceType}
              {company.lastBlockReason ? ` · ${company.lastBlockReason}` : ""}
            </p>
            {company.jobsFetched != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Fetched {company.jobsFetched} · parsed {company.jobsParsed ?? 0} · rejected{" "}
                {company.jobsRejected ?? 0}
                {company.blockedCount ? ` · blocked ${company.blockedCount}` : ""}
                {company.averageLatencyMs ? ` · ${company.averageLatencyMs}ms` : ""}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Report({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <p className="font-medium text-foreground">
        {title} ({rows.length})
      </p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-muted-foreground">
        {rows.length ? rows.map((row) => <li key={row}>{row}</li>) : <li>None</li>}
      </ul>
    </div>
  );
}
