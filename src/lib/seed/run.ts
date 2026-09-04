import { prisma } from "@/lib/db";
import { companyLogo } from "@/lib/utils";
import {
  ADDITIONAL_SKILLS,
  DEFAULT_EXCLUDED,
  DEFAULT_TITLES,
  PREFERRED_LOCATIONS,
  STRONG_SKILLS,
} from "@/lib/relevance/defaults";
import { COMPANY_SEEDS } from "./companies";

export async function seedDatabase() {
  for (const company of COMPANY_SEEDS) {
    await prisma.company.upsert({
      where: { slug: company.slug },
      update: {
        name: company.name,
        careersUrl: company.careersUrl,
        sourceType: company.sourceType,
        sourceConfig: JSON.stringify(company.sourceConfig ?? {}),
        tier: company.tier,
        logo: companyLogo(company.domain),
      },
      create: {
        name: company.name,
        slug: company.slug,
        careersUrl: company.careersUrl,
        sourceType: company.sourceType,
        sourceConfig: JSON.stringify(company.sourceConfig ?? {}),
        tier: company.tier,
        logo: companyLogo(company.domain),
        enabled: company.enabled ?? true,
      },
    });
  }

  await prisma.preference.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      targetTitles: JSON.stringify(DEFAULT_TITLES),
      targetLocations: JSON.stringify(PREFERRED_LOCATIONS),
      targetSkills: JSON.stringify(STRONG_SKILLS),
      additionalSkills: JSON.stringify(ADDITIONAL_SKILLS),
      excludedKeywords: JSON.stringify(DEFAULT_EXCLUDED),
    },
  });

  return { companies: COMPANY_SEEDS.length };
}
