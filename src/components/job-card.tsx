"use client";

import Link from "next/link";
import { Bookmark, Check, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobDTO } from "@/lib/types";
import { cn, formatJobFreshness, scoreTone } from "@/lib/utils";

export function JobCard({
  job,
  onSave,
  onStatus,
}: {
  job: JobDTO;
  onSave: (id: string) => void;
  onStatus: (id: string, status: string) => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {job.company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.company.logo} alt="" className="h-5 w-5 rounded-sm" />
            ) : null}
            <Link href={`/companies/${job.company.slug}`} className="text-xs text-muted-foreground hover:text-foreground">
              {job.company.name}
            </Link>
            {job.isNew ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                NEW
              </Badge>
            ) : null}
          </div>
          <Link href={`/jobs/${job.id}`} className="mt-1 block text-[15px] font-medium leading-snug hover:underline">
            {job.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.city && job.country
                ? `${job.city}, ${job.country}`
                : job.location || job.country || "Location not specified"}
            </span>
            <span>{formatJobFreshness(job.postedAt, job.discoveredAt)}</span>
          </div>
        </div>
        <div className={cn("shrink-0 text-right text-sm font-semibold", scoreTone(job.relevanceScore))}>
          {job.relevanceScore}%
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Match</div>
        </div>
      </div>

      {job.matchReasons.length ? (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {job.matchReasons.slice(0, 6).map((reason) => (
            <li key={reason} className="inline-flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href={job.applicationUrl} target="_blank" rel="noreferrer">
          <Button size="sm">
            View job
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
        <Button size="sm" variant={job.userStatus === "saved" ? "accent" : "outline"} onClick={() => onSave(job.id)}>
          <Bookmark className="h-3.5 w-3.5" />
          {job.userStatus === "saved" ? "Saved" : "Save"}
        </Button>
        <select
          className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
          value={job.userStatus}
          onChange={(event) => onStatus(job.id, event.target.value)}
        >
          <option value="unseen">Unseen</option>
          <option value="seen">Seen</option>
          <option value="saved">Saved</option>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </article>
  );
}
