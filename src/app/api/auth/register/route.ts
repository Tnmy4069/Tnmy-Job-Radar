import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, json } from "@/lib/api";
import {
  copyDefaultPreferences,
  createSession,
  hashPassword,
  toAuthUser,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Enter a name, valid email, and password (8+ characters)");

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return json({ error: "An account with that email already exists" }, 409);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: hashPassword(parsed.data.password),
      role: "candidate",
    },
  });
  await copyDefaultPreferences(user.id);
  await createSession(user.id);
  return json({ user: toAuthUser(user) }, 201);
}
