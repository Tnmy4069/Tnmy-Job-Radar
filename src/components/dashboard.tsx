"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Target, Clock, Briefcase } from "lucide-react";
import { PageIntro } from "@/components/app-shell";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobDTO } from "@/lib/types";
import { isIndiaLocation } from "@/lib/location";

export function Dashboard() {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/jobs?limit=5&sort=ai&relevant=true");
        if (res.ok) {
          const data = await res.json();
          const raw: JobDTO[] = data.jobs || data.items || [];
          setJobs(raw.filter((j) => isIndiaLocation(j.city ?? "", j.country ?? "", j.remoteType, j.location)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const metrics = [
    { label: "New Today", value: "31", icon: Clock, color: "text-blue-500" },
    { label: "Apply Now", value: "7", icon: Target, color: "text-emerald-500" },
    { label: "Strong Matches", value: "12", icon: Sparkles, color: "text-amber-500" },
    { label: "Closing Soon", value: "3", icon: Briefcase, color: "text-rose-500" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-12">
      <PageIntro
        eyebrow="Overview"
        title="Good evening, Tanmay."
        description="7 jobs are worth applying to today."
        action={
          <>
            <Button variant="outline" className="w-full sm:w-auto">
              Run Scan
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/recommended">View Top Matches</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="glass-card rounded-2xl p-3.5 sm:p-5 flex flex-col gap-2 sm:gap-3 group">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-background/50 border border-border/50 transition-colors group-hover:border-primary/20">
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{m.value}</div>
              <div className="text-xs sm:text-[13px] font-semibold text-muted-foreground mt-1 leading-snug">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight">Top Matches</h2>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground shrink-0">
            <Link href="/recommended">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] w-full rounded-2xl border border-border/50 bg-card/30" />
            ))
          ) : jobs.length > 0 ? (
            jobs.map((job) => (
              <JobCard key={job.id} job={job} onSave={() => {}} onStatus={() => {}} />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 sm:p-12 text-center glass">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 border border-accent/20 mb-4">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
              <p className="text-base font-bold text-foreground">No strong matches yet.</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Your next scan may find better opportunities tailored to your profile.
              </p>
              <Button variant="outline" className="mt-6 rounded-full glass">
                Run Scan
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
