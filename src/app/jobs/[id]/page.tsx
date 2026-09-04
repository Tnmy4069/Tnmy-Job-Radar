import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { cn, formatJobFreshness, parseJsonArray, scoreTone } from "@/lib/utils";
import { JobActions } from "@/components/job-actions";
import { getCurrentUser } from "@/lib/auth";

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
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
    <article className="mx-auto max-w-3xl">
      <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← All jobs
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/companies/${job.company.slug}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {job.company.name}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {locationLabel}
            </span>
            <span>{formatJobFreshness(job.postedAt, job.discoveredAt)}</span>
            <span className="capitalize">{job.remoteType}</span>
            <span className="capitalize">{job.sourceType}</span>
          </p>
        </div>
        <div className={cn("text-right text-2xl font-semibold", scoreTone(job.relevanceScore))}>
          {job.relevanceScore}%
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Match</div>
        </div>
      </div>

      {reasons.length ? (
        <ul className="mt-5 grid gap-1 text-sm text-muted-foreground">
          {reasons.map((reason) => (
            <li key={reason}>✓ {reason}</li>
          ))}
        </ul>
      ) : null}

      {skills.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span key={skill} className="rounded-full border border-border px-2 py-0.5 text-xs">
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={job.applicationUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm text-background"
        >
          Apply on official page
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <JobActions id={job.id} status={userStatus} />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Official career source:{" "}
        <a
          href={job.sourceUrl || job.applicationUrl}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-foreground"
        >
          {job.sourceUrl || job.applicationUrl}
        </a>
      </p>

      <section className="job-prose mt-8 text-sm leading-7 text-muted-foreground">
        {job.description ? (
          <div dangerouslySetInnerHTML={{ __html: job.description }} />
        ) : (
          <p>No description was published by the official source for this listing.</p>
        )}
      </section>
    </article>
  );
}
