"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth-types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const data = await fetch("/api/auth/me").then((r) => r.json());
    setUser(data.user ?? null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, refresh, loading: user === undefined };
}
