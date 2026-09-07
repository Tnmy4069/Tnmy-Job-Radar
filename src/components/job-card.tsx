"use client";

import Link from "next/link";
import { Bookmark, Briefcase, ExternalLink, MapPin, Building2, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobDTO } from "@/lib/types";
import { cn, formatJobFreshness, scoreTone } from "@/lib/utils";
import { recommendationGlyph, recommendationLabel } from "@/lib/ai/priority";

type JobCardVariant = "compact" | "default" | "expanded";

export function JobCard({
  job,
  variant = "default",
  onSave,
  onStatus,
}: {
  job: JobDTO;
  variant?: JobCardVariant;
  onSave: (id: string) => void;
  onStatus?: (id: string, status: string) => void;
}) {
  const analyzed = job.aiStatus === "ANALYZED" && job.aiFitScore != null;
  const isCompact = variant === "compact";
  const isExpanded = variant === "expanded";

  return (
    <article
      className={cn(
        "group relative rounded-2xl border bg-card transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col",
        isCompact ? "p-3 gap-2" : "p-3.5 sm:p-5 gap-3"
      )}
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="flex items-start gap-3 min-w-0">
          <div className="hidden sm:flex shrink-0 h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-muted/30 overflow-hidden shadow-sm">
            {job.company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.company.logo} alt={job.company.name} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground/50" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <Link
                href={`/companies/${job.company.slug}`}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {job.company.name}
              </Link>
              {job.isNew && (
                <Badge variant="success" className="h-4 shrink-0 px-1.5 text-[9px] uppercase">
                  New
                </Badge>
              )}
            </div>
            <Link href={`/jobs/${job.id}`} className="block group-hover:text-accent transition-colors">
              <h3
                className={cn(
                  "font-semibold tracking-tight text-foreground line-clamp-2 sm:line-clamp-1",
                  isCompact ? "text-sm" : "text-[15px] sm:text-base"
                )}
              >
                {job.title}
              </h3>
            </Link>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1 text-right">
          {analyzed && job.aiFitScore != null ? (
            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md border border-border/50">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Fit</span>
              <span
                className={cn(
                  "text-sm font-black",
                  job.aiFitScore >= 80
                    ? "text-success"
                    : job.aiFitScore >= 60
                      ? "text-warning"
                      : "text-muted-foreground"
                )}
              >
                {job.aiFitScore}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md border border-border/50">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Radar</span>
              <span className={cn("text-sm font-black", scoreTone(job.relevanceScore))}>{job.relevanceScore}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground sm:ml-[3.25rem]">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate max-w-[10rem] sm:max-w-[150px]">
            {job.city && job.country ? `${job.city}, ${job.country}` : job.location || "Location unspec."}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{formatJobFreshness(job.postedAt, job.discoveredAt)}</span>
        </div>
        {job.experienceLevel && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[120px] capitalize">
              {job.experienceLevel.toLowerCase().replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>

      {!isCompact && analyzed && job.aiRecommendation && (
        <div className="mt-1 sm:ml-[3.25rem] flex items-start gap-2.5 rounded-xl bg-accent/5 border border-accent/10 p-3 transition-colors hover:bg-accent/10">
          <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap">
              {recommendationGlyph(job.aiRecommendation)} {recommendationLabel(job.aiRecommendation)}
            </div>
            {job.aiSummary && isExpanded && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{job.aiSummary}</p>
            )}
          </div>
        </div>
      )}

      {isExpanded && job.skills && job.skills.length > 0 && (
        <div className="mt-1 sm:ml-[3.25rem] flex flex-wrap gap-1.5">
          {job.skills.slice(0, 6).map((skill) => (
            <Badge key={skill} variant="secondary" className="font-normal text-[10px] px-1.5">
              {skill}
            </Badge>
          ))}
          {job.skills.length > 6 && (
            <span className="text-[10px] text-muted-foreground flex items-center pl-1">+{job.skills.length - 6}</span>
          )}
        </div>
      )}

      <div className="mt-auto pt-3 flex flex-wrap items-center gap-2 justify-stretch sm:justify-end">
        {onStatus && (
          <select
            className="h-8 min-w-0 flex-1 sm:flex-none rounded-full border border-border bg-muted/30 px-3 py-1 text-[11px] font-medium text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
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
        )}
        <Button
          size="sm"
          variant={job.userStatus === "saved" ? "default" : "secondary"}
          onClick={() => onSave(job.id)}
          className="h-8 rounded-full px-3 text-xs shrink-0"
          aria-label={job.userStatus === "saved" ? "Saved" : "Save job"}
        >
          <Bookmark className={cn("h-3.5 w-3.5", job.userStatus !== "saved" && "mr-0 sm:mr-1")} />
          {job.userStatus !== "saved" && <span className="hidden sm:inline">Save</span>}
        </Button>
        <Button
          size="sm"
          asChild
          className="h-8 rounded-full px-3 sm:px-4 text-xs font-semibold shadow-sm transition-transform active:scale-95 flex-1 sm:flex-none"
        >
          <a href={job.applicationUrl} target="_blank" rel="noreferrer">
            Apply <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}
