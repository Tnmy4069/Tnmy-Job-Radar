import { AshbyAdapter } from "./ashby";
import { extractedToNormalized, enrichThinJobs, finishResult } from "./base";
import { GreenhouseAdapter } from "./greenhouse";
import { extractHtmlJobLinks } from "./html-links";
import { LeverAdapter } from "./lever";
import { SmartRecruitersAdapter } from "./smartrecruiters";
import { WorkdayAdapter } from "./workday";
import { detectAtsFromHtml, detectAtsFromUrl } from "@/lib/discovery/ats-detect";
import { detectJsShell, extractEmbeddedJsonJobs } from "@/lib/discovery/embedded";
import { parseRobotsTxt } from "@/lib/discovery/robots";
import { filterOfficialJobUrls, parseSitemapXml, sitemapCandidatesFromRobots } from "@/lib/discovery/sitemap";
import { originOf } from "@/lib/discovery/urls";
import { SourceBlockError, fetchText } from "@/lib/http";
import type { AdapterResult, CompanySource, JobSourceAdapter, NormalizedJob } from "./types";

const atsAdapters: Record<string, JobSourceAdapter> = {
  greenhouse: new GreenhouseAdapter(),
  lever: new LeverAdapter(),
  ashby: new AshbyAdapter(),
  smartrecruiters: new SmartRecruitersAdapter(),
  workday: new WorkdayAdapter(),
};

async function delegateAts(company: CompanySource, type: string, config: Record<string, unknown>): Promise<AdapterResult> {
  const adapter = atsAdapters[type];
  if (!adapter) {
    return { jobs: [], unsupported: true, warning: `No adapter for detected ATS ${type}` };
  }
  const result = await adapter.fetchJobs({
    ...company,
    sourceType: type,
    sourceConfig: { ...company.sourceConfig, ...config },
  });
  return {
    ...result,
    detectedSourceType: type,
    detectedSourceConfig: config,
  };
}

async function fetchSitemapJobs(company: CompanySource): Promise<NormalizedJob[]> {
  const origin = originOf(company.careersUrl);
  if (!origin) return [];
  let sitemaps: string[] = [];
  try {
    const robots = await fetchText(`${origin}/robots.txt`, { headers: { Accept: "text/plain" } }, { respectRobots: false });
    sitemaps = parseRobotsTxt(robots).sitemaps;
  } catch {
    sitemaps = [];
  }
  const jobs: NormalizedJob[] = [];
  for (const sitemapUrl of sitemapCandidatesFromRobots(sitemaps, company.careersUrl).slice(0, 4)) {
    try {
      const xml = await fetchText(sitemapUrl, { headers: { Accept: "application/xml, text/xml, */*;q=0.5" } });
      const locs = filterOfficialJobUrls(parseSitemapXml(xml), company.careersUrl).slice(0, 30);
      for (const loc of locs) {
        try {
          const html = await fetchText(loc, { headers: { Accept: "text/html" } });
          const extracted = extractEmbeddedJsonJobs(html, loc);
          jobs.push(...extracted.map((job) => extractedToNormalized(job, company, job.source === "jsonld" ? "jsonld" : "json")));
        } catch {
          // keep scanning other loc URLs
        }
      }
    } catch {
      // try the next official sitemap
    }
  }
  return jobs;
}

export async function fetchOfficialJobs(company: CompanySource): Promise<AdapterResult> {
  const fromUrl = detectAtsFromUrl(company.careersUrl);
  if (fromUrl) return delegateAts(company, fromUrl.type, fromUrl.config);

  let html = "";
  try {
    html = await fetchText(company.careersUrl, { headers: { Accept: "text/html" } });
  } catch (error) {
    if (error instanceof SourceBlockError) {
      return {
        jobs: [],
        blockReason: error.reason,
        warning: error.message,
      };
    }
    throw error;
  }

  const fromHtml = detectAtsFromHtml(html, company.careersUrl);
  if (fromHtml) return delegateAts(company, fromHtml.type, fromHtml.config);

  const embedded = extractEmbeddedJsonJobs(html, company.careersUrl).map((job) =>
    extractedToNormalized(job, company, job.source === "jsonld" ? "jsonld" : "json")
  );
  let jobs = embedded;
  let method: AdapterResult["extractionMethod"] = embedded.length ? "jsonld" : "html";

  if (jobs.length === 0) {
    jobs = await fetchSitemapJobs(company);
    if (jobs.length) method = "jsonld";
  }

  if (jobs.length === 0) {
    jobs = extractHtmlJobLinks(html, company.careersUrl).map((link) =>
      extractedToNormalized(
        {
          title: link.title,
          applicationUrl: link.applicationUrl,
          description: "",
          location: "",
          source: "embedded-json",
        },
        company,
        "html"
      )
    );
    method = "html";
  }

  if (jobs.length === 0) {
    const jsShell = detectJsShell(html);
    if (jsShell) {
      const { fetchRenderedHtml } = await import("@/lib/discovery/browser");
      const rendered = await fetchRenderedHtml(company.careersUrl);
      if (rendered) {
        const fromBrowser = extractEmbeddedJsonJobs(rendered, company.careersUrl).map((job) =>
          extractedToNormalized(job, company, "browser")
        );
        const links =
          fromBrowser.length > 0
            ? fromBrowser
            : extractHtmlJobLinks(rendered, company.careersUrl).map((link) =>
                extractedToNormalized(
                  {
                    title: link.title,
                    applicationUrl: link.applicationUrl,
                    description: "",
                    location: "",
                    source: "embedded-json",
                  },
                  company,
                  "browser"
                )
              );
        if (links.length) {
          return finishResult(await enrichThinJobs(links, company), company, "browser");
        }
      }
    }
    return {
      jobs: [],
      unsupported: true,
      jsShell,
      warning: jsShell
        ? "JavaScript-rendered official careers page; HTTP fetch returned a shell"
        : "No official JSON-LD, embedded job feed, sitemap jobs, or listing links found",
    };
  }

  if (jobs.some((job) => !job.description)) {
    jobs = await enrichThinJobs(jobs, company);
  }

  return finishResult(jobs, company, method ?? "html");
}
