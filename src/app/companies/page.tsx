"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import type { CompanyDTO } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);

  useEffect(() => {
    void fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []));
  }, []);

  return (
    <div>
      <PageIntro
        eyebrow="Companies"
        title="Official sources"
        description="Each company is stored in the database and can be enabled without changing code."
      />
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
              <Badge className="capitalize">{company.checkStatus}</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {company.relevant} relevant · {company.isNew} new · {company.jobsFound} stored
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last checked {timeAgo(company.lastCheckedAt)} · {company.sourceType}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
