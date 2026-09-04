"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function JobActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);

  async function save() {
    const res = await fetch(`/api/jobs/${id}/save`, { method: "POST" }).then((r) => r.json());
    setCurrent(res.userStatus);
    router.refresh();
  }

  async function change(next: string) {
    await fetch(`/api/jobs/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setCurrent(next);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" onClick={save}>
        {current === "saved" ? "Saved" : "Save"}
      </Button>
      <select
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        value={current}
        onChange={(event) => change(event.target.value)}
      >
        <option value="unseen">Unseen</option>
        <option value="seen">Seen</option>
        <option value="saved">Saved</option>
        <option value="applied">Applied</option>
        <option value="interview">Interview</option>
        <option value="offer">Offer</option>
        <option value="rejected">Rejected</option>
      </select>
    </>
  );
}
