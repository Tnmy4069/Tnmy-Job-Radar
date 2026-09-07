"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/app-shell";

export function AuthForm({
  mode,
  admin = false,
}: {
  mode: "login" | "register";
  admin?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const url = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const body =
      mode === "register"
        ? { name, email, password }
        : { email, password, admin };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not continue");
      return;
    }
    window.location.href = admin ? "/admin69" : "/";
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 sm:py-12">
      <PageIntro
        eyebrow={admin ? "Superadmin" : "Account"}
        title={
          admin ? "Admin sign in" : mode === "register" ? "Create candidate account" : "Sign in"
        }
        description={
          admin
            ? "Restricted console for scans, companies, and accounts."
            : mode === "register"
              ? "Save jobs, track applications, and keep your matching profile."
              : "Use your candidate email to continue."
        }
      />
      <form onSubmit={submit} className="grid gap-3">
        {mode === "register" ? (
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs text-muted-foreground">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs text-muted-foreground">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs text-muted-foreground">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === "register" ? 8 : 1}
            required
          />
        </label>
        {error ? <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
        </Button>
      </form>
      {admin ? null : (
        <p className="mt-4 text-sm text-muted-foreground">
          {mode === "register" ? (
            <>
              Already have an account?{" "}
              <a href="/login" className="text-foreground underline">
                Sign in
              </a>
            </>
          ) : (
            <>
              New here?{" "}
              <a href="/register" className="text-foreground underline">
                Create an account
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
