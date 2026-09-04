import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { companyLogo } from "@/lib/utils";
import {
  ADDITIONAL_SKILLS,
  DEFAULT_EXCLUDED,
  DEFAULT_TITLES,
  PREFERRED_LOCATIONS,
  STRONG_SKILLS,
} from "@/lib/relevance/defaults";
import { ensureSuperadmin } from "@/lib/auth";
import {
  ALL_COMPANY_SEEDS,
  PRESERVE_UNSUPPORTED,
  PRESERVE_VERIFIED,
  enrichSeed,
} from "./companies";

export async function seedDatabase() {
  const existingRows = await prisma.company.findMany();
  const bySlug = new Map(existingRows.map((row) => [row.slug, row]));

  for (const raw of ALL_COMPANY_SEEDS) {
    const company = enrichSeed(raw);
    const website = `https://${company.domain.replace(/^www\./, "")}`;
    const existing = bySlug.get(company.slug);

    if (existing) {
      const data: Prisma.CompanyUpdateInput = {
        name: company.name,
        logo: existing.logo || companyLogo(company.domain),
        website: existing.website || website,
        category: existing.category && existing.category !== "OTHER_PRODUCT" ? existing.category : company.category,
        priority: existing.priority || company.priority,
        indiaHiring: existing.indiaHiring && existing.indiaHiring !== "unknown" ? existing.indiaHiring : company.indiaHiring,
      };

      if (PRESERVE_UNSUPPORTED.has(company.slug)) {
        data.enabled = false;
        data.sourceStatus = "UNSUPPORTED";
        data.sourceNotes = company.sourceNotes || existing.sourceNotes;
      } else if (PRESERVE_VERIFIED.has(company.slug)) {
        data.sourceStatus = existing.sourceStatus === "FAILED" ? existing.sourceStatus : "VERIFIED";
      } else if (
        existing.sourceStatus === "VERIFIED" ||
        existing.sourceStatus === "FAILED" ||
        existing.sourceStatus === "UNSUPPORTED" ||
        existing.sourceStatus === "DISABLED"
      ) {
        // Keep live verification state.
      } else {
        data.sourceStatus = company.sourceStatus;
      }

      await prisma.company.update({ where: { id: existing.id }, data });
    } else {
      await prisma.company.create({
        data: {
          name: company.name,
          slug: company.slug,
          careersUrl: company.careersUrl,
          sourceType: company.sourceType,
          sourceConfig: JSON.stringify(company.sourceConfig ?? {}),
          tier: company.tier,
          logo: companyLogo(company.domain),
          enabled: PRESERVE_VERIFIED.has(company.slug),
          website,
          category: company.category,
          priority: company.priority,
          indiaHiring: company.indiaHiring,
          sourceStatus: company.sourceStatus,
          sourceNotes: company.sourceNotes ?? "",
        },
      });
    }
  }

  const prefs = await prisma.preference.findUnique({ where: { id: "default" } });
  if (!prefs) {
    await prisma.preference.create({
      data: {
        id: "default",
        targetTitles: JSON.stringify(DEFAULT_TITLES),
        targetLocations: JSON.stringify(PREFERRED_LOCATIONS),
        targetSkills: JSON.stringify(STRONG_SKILLS),
        additionalSkills: JSON.stringify(ADDITIONAL_SKILLS),
        excludedKeywords: JSON.stringify(DEFAULT_EXCLUDED),
      },
    });
  }

  await ensureSuperadmin();
  return { companies: ALL_COMPANY_SEEDS.length };
}
