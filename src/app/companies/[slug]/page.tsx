import { CompanyDetailPage } from "@/components/company-detail";

export default async function Page({ params }: PageProps<"/companies/[slug]">) {
  const { slug } = await params;
  return <CompanyDetailPage slug={slug} />;
}
