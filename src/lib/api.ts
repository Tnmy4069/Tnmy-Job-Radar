import { NextResponse } from "next/server";

export function json<T>(data: T, init?: number | ResponseInit) {
  const options = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, options);
}

export function badRequest(message: string) {
  return json({ error: message }, 400);
}

export function notFound(message = "Not found") {
  return json({ error: message }, 404);
}

const scanTimestamps: number[] = [];

export function allowManualScan(limit = 4, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  while (scanTimestamps.length && now - scanTimestamps[0] > windowMs) {
    scanTimestamps.shift();
  }
  if (scanTimestamps.length >= limit) return false;
  scanTimestamps.push(now);
  return true;
}
