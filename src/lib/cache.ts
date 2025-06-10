import { NextResponse } from "next/server";

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedResponse(key: string): NextResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return NextResponse.json(entry.data);
}

export function setCachedResponse(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function generateCacheKey(req: Request): string {
  const url = new URL(req.url);
  return `${url.pathname}${url.search}`;
}

export function clearCache(): void {
  cache.clear();
}

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, CACHE_TTL); 