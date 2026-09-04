import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Building2, Clock, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { cn, formatJobFreshness, parseJsonArray, scoreTone } from "@/lib/utils";
import { JobActions } from "@/components/job-actions";
import { AiAssessment } from "@/components/ai-assessment";
import { getCurrentUser } from "@/lib/auth";
import { analysisFromJob } from "@/lib/ai/dto";
import { Badge } from "@/components/ui/badge";

// @ts-expect-error Types issue with dynamic segments
export default async function JobPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!job) notFound();

  const user = await getCurrentUser();
  const tracked = user
    ? await prisma.userJob.findUnique({
        where: { userId_jobId: { userId: user.id, jobId: job.id } },
      })
    : null;
  const userStatus = tracked?.status ?? (user ? "unseen" : job.userStatus);

  const reasons = parseJsonArray(job.matchReasons);
  const skills = parseJsonArray(job.skills);
  const locationLabel =
    job.city && job.country
      ? `${job.city}, ${job.country}`
      : job.location || "Location not specified";

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-12 animate-in fade-in duration-500 pt-6 px-4 lg:px-6">
      <article className="flex-1 min-w-0 max-w-4xl">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-6">
          <Link href="/jobs" className="hover:text-foreground transition-colors">Jobs</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/companies/${job.company.slug}`} className="hover:text-foreground transition-colors truncate">{job.company.name}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground truncate">{job.title}</span>
        </nav>

        <header className="mb-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 shrink-0 flex items-center justify-center rounded-lg border border-border bg-muted/50 overflow-hidden">
                  {job.company.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.company.logo} alt={job.company.name} className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                    {job.title}
                  </h1>
                  <Link href={`/companies/${job.company.slug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mt-1 inline-block">
                    {job.company.name}
                  </Link>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-4">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {locationLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatJobFreshness(job.postedAt, job.discoveredAt)}
                </span>
                {job.remoteType && (
                  <Badge variant="secondary" className="capitalize">{job.remoteType}</Badge>
                )}
                <Badge variant="outline" className="capitalize border-border">{job.sourceType}</Badge>
              </div>
            </div>

            <div className="shrink-0 text-right hidden sm:block">
              <div className={cn("text-3xl font-bold tracking-tighter", scoreTone(job.relevanceScore))}>
                {job.relevanceScore}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                Radar Match
              </div>
            </div>
          </div>
        </header>

        {reasons.length > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Match Factors</h3>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-foreground">
                  <span className="text-success font-bold shrink-0">✓</span>
                  <span className="leading-snug">{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-8">
          <AiAssessment
            jobId={job.id}
            relevanceScore={job.relevanceScore}
            status={job.aiStatus}
            initial={analysisFromJob(job)}
          />
        </div>

        {skills.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Extracted Skills</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="px-2.5 py-1 text-xs font-medium">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Job Description</h3>
          <section className="job-prose text-sm leading-relaxed text-foreground/90 bg-card rounded-xl border border-border p-5 sm:p-6">
            {job.description ? (
              <div dangerouslySetInnerHTML={{ __html: job.description }} />
            ) : (
              <p className="text-muted-foreground italic">No description was published by the official source.</p>
            )}
          </section>
        </div>
        
        <p className="text-xs text-muted-foreground flex flex-col gap-1">
          <span>Official career source:</span>
          <a
            href={job.sourceUrl || job.applicationUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate hover:text-foreground hover:underline transition-colors block max-w-full"
          >
            {job.sourceUrl || job.applicationUrl}
          </a>
        </p>
      </article>

      {/* Right Action Panel (Sticky) */}
      <aside className="w-full lg:w-72 shrink-0">
        <div className="sticky top-20 rounded-xl border border-border bg-card p-5 flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Actions</h3>
          <a
            href={job.applicationUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground hover:bg-foreground/90 text-background py-2.5 px-3 text-sm font-medium transition-colors"
          >
            Apply on official page
            <ExternalLink className="h-4 w-4" />
          </a>
          
          <div className="h-px w-full bg-border" />
          
          <div className="flex flex-col gap-3 w-full">
            <JobActions id={job.id} status={userStatus} />
          </div>
        </div>
      </aside>
    </div>
  );
}
