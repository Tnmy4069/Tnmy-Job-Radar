import { maxPagesPerSource } from "./config";

export type PaginationState = {
  page: number;
  offset?: number;
  cursor?: string | null;
  nextUrl?: string | null;
  seenIds: Set<string>;
};

export function createPaginationState(): PaginationState {
  return { page: 1, seenIds: new Set() };
}

export function nextOffset(offset: number, limit: number): number {
  return offset + limit;
}

export function withPageParam(url: string, page: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

export function withOffsetParams(url: string, offset: number, limit: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("offset", String(offset));
  parsed.searchParams.set("limit", String(limit));
  return parsed.toString();
}

export function readNextLink(payload: unknown, html?: string): string | null {
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    const next =
      rec.next ?? rec.nextPage ?? rec.next_url ?? rec.nextUrl ?? rec.cursor ?? rec.nextCursor;
    if (typeof next === "string" && next && next !== "null") return next;
    if (next && typeof next === "object" && next !== null && "url" in next) {
      const url = (next as { url?: unknown }).url;
      if (typeof url === "string") return url;
    }
  }
  if (html) {
    const rel = html.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)/i);
    if (rel?.[1]) return rel[1];
    const anchor = html.match(/<a[^>]+rel=["']next["'][^>]+href=["']([^"']+)/i);
    if (anchor?.[1]) return anchor[1];
  }
  return null;
}

export function shouldStopPagination(input: {
  page: number;
  batchIds: string[];
  seenIds: Set<string>;
  batchSize: number;
  pageSize: number;
  next?: string | null;
  maxPages?: number;
}): boolean {
  const maxPages = input.maxPages ?? maxPagesPerSource();
  if (input.page >= maxPages) return true;
  if (input.batchSize === 0) return true;
  if (input.batchSize < input.pageSize && !input.next) return true;
  const fresh = input.batchIds.filter((id) => !input.seenIds.has(id));
  if (fresh.length === 0) return true;
  if (!input.next && input.batchSize < input.pageSize) return true;
  return false;
}

export function rememberIds(state: PaginationState, ids: string[]) {
  for (const id of ids) state.seenIds.add(id);
}
