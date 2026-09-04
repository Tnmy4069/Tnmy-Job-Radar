import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, json, unauthorized } from "@/lib/api";
import { createSession, toAuthUser, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  admin: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Enter email and password");

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return unauthorized("Invalid email or password");
  }
  if (parsed.data.admin && user.role !== "superadmin") {
    return forbidden("Superadmin only");
  }
  await createSession(user.id);
  return json({ user: toAuthUser(user) });
}
