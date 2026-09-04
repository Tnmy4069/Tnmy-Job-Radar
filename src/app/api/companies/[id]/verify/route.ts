import { json, notFound } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { verifyCompanySource } from "@/lib/companies/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await context.params;
  try {
    const result = await verifyCompanySource(id, { enableIfVerified: true });
    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof Error && error.message === "Company not found") return notFound(error.message);
    return json({ ok: false, message: error instanceof Error ? error.message : "Verify failed" }, 500);
  }
}
