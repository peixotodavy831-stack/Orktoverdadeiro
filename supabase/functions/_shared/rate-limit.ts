export type RateLimitBucket = { started: number; count: number };

export function consumeWindowRateLimit(
  buckets: Map<string, RateLimitBucket>,
  key: string,
  now: number,
  options: { maxRequests?: number; windowMs?: number; maxEntries?: number } = {},
): boolean {
  const maxRequests = options.maxRequests ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const maxEntries = options.maxEntries ?? 4_096;
  const prior = buckets.get(key);

  if (prior && now - prior.started < windowMs) {
    prior.count += 1;
    return prior.count > maxRequests;
  }

  if (prior) buckets.delete(key);
  if (buckets.size >= maxEntries) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.started >= windowMs) buckets.delete(bucketKey);
    }
    if (buckets.size >= maxEntries) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
  }

  buckets.set(key, { started: now, count: 1 });
  return false;
}
