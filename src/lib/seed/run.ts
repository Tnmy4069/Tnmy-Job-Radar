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
import { COMPANY_SEEDS } from "./companies";

export async function seedDatabase() {
  for (const company of COMPANY_SEEDS) {
    const data = {
      name: company.name,
      careersUrl: company.careersUrl,
      sourceType: company.sourceType,
      sourceConfig: JSON.stringify(company.sourceConfig ?? {}),
      tier: company.tier,
      logo: companyLogo(company.domain),
    };
    const existing = await prisma.company.findUnique({ where: { slug: company.slug } });
    if (existing) {
      await prisma.company.update({ where: { id: existing.id }, data });
    } else {
      await prisma.company.create({
        data: {
          ...data,
          slug: company.slug,
          enabled: company.enabled ?? true,
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
  return { companies: COMPANY_SEEDS.length };
}
