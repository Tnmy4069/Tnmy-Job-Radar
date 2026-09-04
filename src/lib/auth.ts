import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { forbidden, json, unauthorized } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-types";
import {
  ADDITIONAL_SKILLS,
  DEFAULT_EXCLUDED,
  DEFAULT_TITLES,
  PREFERRED_LOCATIONS,
  STRONG_SKILLS,
} from "@/lib/relevance/defaults";

export type { AuthUser } from "@/lib/auth-types";

export const SESSION_COOKIE = "jr_session";
const SESSION_DAYS = 30;

export function toAuthUser(user: { id: string; email: string; name: string; role: string }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "superadmin" ? "superadmin" : "candidate",
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(prev, next);
}

export async function createSession(userId: string) {
  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    return session.user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: unauthorized() };
  return { user, response: null };
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: unauthorized() };
  if (user.role !== "superadmin") return { user: null, response: forbidden("Superadmin only") };
  return { user, response: null };
}

export function authJson(user: AuthUser) {
  return json({ user });
}

export async function copyDefaultPreferences(userId: string) {
  const existing = await prisma.preference.findUnique({ where: { id: userId } });
  if (existing) return existing;
  const fallback =
    (await prisma.preference.findUnique({ where: { id: "default" } })) ??
    (await prisma.preference.create({
      data: {
        id: "default",
        targetTitles: JSON.stringify(DEFAULT_TITLES),
        targetLocations: JSON.stringify(PREFERRED_LOCATIONS),
        targetSkills: JSON.stringify(STRONG_SKILLS),
        additionalSkills: JSON.stringify(ADDITIONAL_SKILLS),
        excludedKeywords: JSON.stringify(DEFAULT_EXCLUDED),
      },
    }));
  return prisma.preference.create({
    data: {
      id: userId,
      userId,
      targetTitles: fallback.targetTitles,
      targetLocations: fallback.targetLocations,
      targetSkills: fallback.targetSkills,
      additionalSkills: fallback.additionalSkills,
      experienceLevel: fallback.experienceLevel,
      remotePreference: fallback.remotePreference,
      excludedKeywords: fallback.excludedKeywords,
      minimumRelevanceScore: fallback.minimumRelevanceScore,
      includeSeniorRoles: fallback.includeSeniorRoles,
      allowInternational: fallback.allowInternational,
      notifyMinScore: fallback.notifyMinScore,
      scanFrequency: "manual",
    },
  });
}

export async function ensureSuperadmin() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@jobradar.local").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin69";
  const existing = await prisma.user.findFirst({ where: { role: "superadmin" } });
  if (existing) {
    if (existing.email !== email) {
      await prisma.user.update({ where: { id: existing.id }, data: { email } });
    }
    return existing;
  }
  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) {
    return prisma.user.update({
      where: { id: taken.id },
      data: { role: "superadmin", passwordHash: hashPassword(password) },
    });
  }
  return prisma.user.create({
    data: {
      email,
      name: "Superadmin",
      role: "superadmin",
      passwordHash: hashPassword(password),
    },
  });
}
