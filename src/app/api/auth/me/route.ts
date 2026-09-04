import { json } from "@/lib/api";
import { getCurrentUser, toAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return json({ user: user ? toAuthUser(user) : null });
}
