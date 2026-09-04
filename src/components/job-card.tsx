"use client";

import Link from "next/link";
import { Bookmark, Check, ExternalLink, MapPin, Building2, Clock, Sparkles } from "lucide-react";
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
    <article className={cn(
      "group relative rounded-xl border bg-card transition-all hover:border-sidebar-border hover:shadow-sm flex flex-col",
      isCompact ? "p-3 gap-2" : "p-4 sm:p-5 gap-3"
    )}>
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4 w-full">
        <div className="flex items-start gap-3 min-w-0">
          {/* Logo */}
          <div className="hidden sm:flex shrink-0 h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/50 overflow-hidden">
            {job.company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.company.logo} alt={job.company.name} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/companies/${job.company.slug}`} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors truncate">
                {job.company.name}
              </Link>
              {job.isNew && (
                <Badge variant="success" className="h-4 px-1.5 text-[9px] uppercase">New</Badge>
              )}
            </div>
            <Link href={`/jobs/${job.id}`} className="block group-hover:text-accent transition-colors">
              <h3 className={cn("font-semibold tracking-tight text-foreground line-clamp-1", isCompact ? "text-sm" : "text-base")}>
                {job.title}
              </h3>
            </Link>
          </div>
        </div>

        {/* Scores */}
        <div className="shrink-0 flex flex-col items-end gap-1 text-right">
          {analyzed && job.aiFitScore != null ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Fit</span>
              <span className={cn("text-base font-bold", job.aiFitScore >= 80 ? "text-success" : job.aiFitScore >= 60 ? "text-warning" : "text-muted-foreground")}>
                {job.aiFitScore}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Radar</span>
              <span className={cn("text-base font-bold", scoreTone(job.relevanceScore))}>
                {job.relevanceScore}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ml-0 sm:ml-13">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          <span className="truncate max-w-[150px]">
            {job.city && job.country ? `${job.city}, ${job.country}` : job.location || "Location unspec."}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatJobFreshness(job.postedAt, job.discoveredAt)}</span>
        </div>
        {job.experienceLevel && (
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            <span className="truncate max-w-[120px] capitalize">{job.experienceLevel.toLowerCase().replace(/_/g, ' ')}</span>
          </div>
        )}
      </div>

      {/* AI Recommendation Snippet (if expanded or default) */}
      {!isCompact && analyzed && job.aiRecommendation && (
        <div className="mt-1 ml-0 sm:ml-13 flex items-start gap-2 rounded-md bg-accent/5 border border-accent/10 p-2.5">
          <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {recommendationGlyph(job.aiRecommendation)} {recommendationLabel(job.aiRecommendation)}
            </div>
            {job.aiSummary && isExpanded && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {job.aiSummary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Skills (if expanded) */}
      {isExpanded && job.skills && job.skills.length > 0 && (
        <div className="mt-1 ml-0 sm:ml-13 flex flex-wrap gap-1.5">
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

      {/* Actions */}
      <div className="mt-auto pt-3 flex items-center gap-2 justify-end">
        {onStatus && (
          <select
            className="h-8 rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-accent outline-none"
            value={job.userStatus}
            onChange={(event) => onStatus(job.id, event.target.value)}
          >
            <option value="unseen">Status: Unseen</option>
            <option value="seen">Status: Seen</option>
            <option value="saved">Status: Saved</option>
            <option value="applied">Status: Applied</option>
            <option value="interview">Status: Interview</option>
            <option value="offer">Status: Offer</option>
            <option value="rejected">Status: Rejected</option>
          </select>
        )}
        <Button size="sm" variant={job.userStatus === "saved" ? "default" : "secondary"} onClick={() => onSave(job.id)} className="h-8">
          <Bookmark className={cn("h-3.5 w-3.5", job.userStatus !== "saved" && "mr-1")} />
          {job.userStatus !== "saved" && "Save"}
        </Button>
        <Button size="sm" asChild className="h-8 bg-foreground text-background hover:bg-foreground/90">
          <a href={job.applicationUrl} target="_blank" rel="noreferrer">
            Apply <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}
