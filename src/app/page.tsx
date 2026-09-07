import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  
  if (user) {
    const cookieStore = await cookies();
    const onboarded = cookieStore.get("jr_onboarded");
    
    if (!onboarded) {
      redirect("/onboarding");
    }
    redirect("/dashboard");
  }

  return <LandingPage />;
}
