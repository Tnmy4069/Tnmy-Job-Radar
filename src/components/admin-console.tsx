"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageIntro } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/use-auth";
import { timeAgo } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

type Stats = {
  relevant: number;
  newToday: number;
  excellent: number;
  saved: number;
  applied: number;
};

export function AdminConsole() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [usersRes, statsRes] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]);
    setUsers(usersRes.users ?? []);
    setStats(statsRes);
  }

  useEffect(() => {
    if (user?.role === "superadmin") void load();
  }, [user]);

  async function scanNow() {
    setScanning(true);
    setMessage("Starting scan…");
    const res = await fetch("/api/scan", { method: "POST" }).then((r) => r.json());
    if (!res.ok && !res.running) {
      setMessage(res.message ?? "Scan failed");
      setScanning(false);
      return;
    }
    const timer = setInterval(async () => {
      const status = await fetch("/api/scan/status").then((r) => r.json());
      if (!status.running) {
        clearInterval(timer);
        setScanning(false);
        setMessage("Scan complete");
        await load();
      }
    }, 2000);
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!user || user.role !== "superadmin") return <AuthForm mode="login" admin />;

  return (
    <div>
      <PageIntro
        eyebrow="Superadmin"
        title="Control plane"
        description={`Signed in as ${user.email}. Manage candidates, scans, and system matching.`}
        action={
          <Button onClick={scanNow} disabled={scanning}>
            {scanning ? "Scanning…" : "Scan now"}
          </Button>
        }
      />
      {message ? <p className="mb-4 text-xs text-muted-foreground">{message}</p> : null}

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Candidates" value={users.filter((item) => item.role === "candidate").length} />
        <Stat label="Relevant jobs" value={stats?.relevant ?? 0} />
        <Stat label="New today" value={stats?.newToday ?? 0} />
        <Stat label="Excellent" value={stats?.excellent ?? 0} />
        <Stat label="Admins" value={users.filter((item) => item.role === "superadmin").length} />
      </section>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/settings" className="rounded-md border border-border px-3 py-1.5">
          System matching profile
        </Link>
        <Link href="/companies" className="rounded-md border border-border px-3 py-1.5">
          Companies
        </Link>
        <Link href="/" className="rounded-md border border-border px-3 py-1.5">
          Job feed
        </Link>
      </div>

      <h2 className="mb-3 text-sm font-medium">Accounts</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2">{item.name || "—"}</td>
                <td className="px-3 py-2">{item.email}</td>
                <td className="px-3 py-2 capitalize">{item.role}</td>
                <td className="px-3 py-2 text-muted-foreground">{timeAgo(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
