"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/app-shell";
import type { JobDTO } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { useAuth } from "@/components/use-auth";

type CompanyDetail = {
  name: string;
  slug: string;
  careersUrl: string;
  sourceType: string;
  lastCheckedAt: string | null;
  checkStatus: string;
  lastError: string | null;
  relevant: number;
  isNew: number;
  all: number;
  active?: number;
  enabled: boolean;
};

export function CompanyDetailPage({ slug }: { slug: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "superadmin";
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [view, setView] = useState("relevant");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  async function load(nextView = view) {
    const data = await fetch(`/api/companies/${slug}?view=${nextView}`).then((r) => r.json());
    setCompany(data.company);
    setJobs(data.jobs ?? []);
  }

  useEffect(() => {
    void load(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, view]);

  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(async () => {
      const status = await fetch("/api/scan/status").then((r) => r.json());
      if (!status.running) {
        clearInterval(timer);
        setScanning(false);
        setScanMessage("Scan complete");
        await load(view);
      }
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, view, slug]);

  async function scanCompany() {
    if (scanning) return;
    setScanning(true);
    setScanMessage("Scanning…");
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: slug }),
    }).then((r) => r.json());
    if (!res.ok && !res.running) {
      setScanMessage(res.message ?? "Scan failed");
      setScanning(false);
    }
  }

  async function toggle() {
    if (!company) return;
    await fetch(`/api/companies/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !company.enabled }),
    });
    await load(view);
  }

  if (!company) return <div className="text-sm text-muted-foreground">Loading company…</div>;

  return (
    <div>
      <PageIntro
        title={company.name}
        description={`${company.active ?? company.all} active · ${company.relevant} relevant · ${company.isNew} new · ${company.all} total`}
        action={
          isAdmin ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={toggle}>
                {company.enabled ? "Disable" : "Enable"}
              </Button>
              <Button onClick={scanCompany} disabled={scanning}>
                {scanning ? "Scanning…" : "Scan now"}
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="mb-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Last checked {timeAgo(company.lastCheckedAt)}</span>
        <span className="capitalize">{company.checkStatus}</span>
        <span>{company.sourceType}</span>
        <a href={company.careersUrl} target="_blank" rel="noreferrer" className="text-foreground">
          Careers page
        </a>
      </div>
      {scanMessage ? <p className="mb-2 text-xs text-muted-foreground">{scanMessage}</p> : null}
      {company.lastError ? (
        <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">{company.lastError}</p>
      ) : null}

      <div className="mb-4 flex gap-2">
        {["relevant", "new", "all"].map((item) => (
          <button
            key={item}
            onClick={() => setView(item)}
            className={`h-8 rounded-md border px-3 text-xs capitalize ${view === item ? "bg-foreground text-background" : "bg-card"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onSave={async (id) => {
              const res = await fetch(`/api/jobs/${id}/save`, { method: "POST" });
              if (res.status === 401) {
                window.location.href = "/login";
                return;
              }
              await load(view);
            }}
            onStatus={async (id, status) => {
              const res = await fetch(`/api/jobs/${id}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
              });
              if (res.status === 401) {
                window.location.href = "/login";
                return;
              }
              await load(view);
            }}
          />
        ))}
      </div>
      <Link href="/companies" className="mt-6 inline-block text-xs text-muted-foreground">
        ← All companies
      </Link>
    </div>
  );
}
