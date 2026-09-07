import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const onboarded = cookieStore.get("jr_onboarded");
  if (!onboarded) redirect("/onboarding");

  return <Dashboard />;
}
