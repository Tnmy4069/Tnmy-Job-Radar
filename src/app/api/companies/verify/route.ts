import { json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { verifyCompanySources } from "@/lib/companies/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;
  const results = await verifyCompanySources({ onlyUnverified: true, enableIfVerified: true });
  return json({
    ok: true,
    attempted: results.length,
    verified: results.filter((row) => row.sourceStatus === "VERIFIED").length,
    unsupported: results.filter((row) => row.sourceStatus === "UNSUPPORTED").length,
    failed: results.filter((row) => row.sourceStatus === "FAILED").length,
    results,
  });
}
