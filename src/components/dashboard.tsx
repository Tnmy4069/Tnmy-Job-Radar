"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Target, Clock, Briefcase } from "lucide-react";
import { PageIntro } from "@/components/app-shell";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobDTO } from "@/lib/types";

export function Dashboard() {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/jobs?limit=5&sort=ai&relevant=true");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.items || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Use arbitrary/placeholder metrics for the UI pass, or fetch them if an endpoint exists.
  // The backend might not have an aggregate endpoint, so these are illustrative of the design.
  const metrics = [
    { label: "New Today", value: "31", icon: Clock, color: "text-blue-500" },
    { label: "Apply Now", value: "7", icon: Target, color: "text-emerald-500" },
    { label: "Strong Matches", value: "12", icon: Sparkles, color: "text-amber-500" },
    { label: "Closing Soon", value: "3", icon: Briefcase, color: "text-rose-500" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="pt-6">
        <PageIntro
          eyebrow="Overview"
          title="Good evening, Tanmay."
          description="7 jobs are worth applying to today."
          action={
            <div className="flex items-center gap-3">
              <Button variant="outline">Run Scan</Button>
              <Button asChild>
                <Link href="/recommended">View Top Matches</Link>
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 lg:px-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 transition-colors hover:border-sidebar-border">
            <div className="flex items-center justify-between">
              <m.icon className={`h-5 w-5 ${m.color}`} />
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-foreground">{m.value}</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 lg:px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Top Matches</h2>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link href="/recommended">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))
          ) : jobs.length > 0 ? (
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onSave={() => {}}
                onStatus={() => {}}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">No strong matches yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Your next scan may find better opportunities.</p>
              <Button variant="outline" className="mt-4">Run Scan</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
