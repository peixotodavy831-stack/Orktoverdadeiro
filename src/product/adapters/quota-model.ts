export type QuotaSnapshot =
  | { state: 'unknown' | 'invalid' }
  | { state: 'known'; used: number; limit: number; remaining: number; percentage: number; tone: 'normal' | 'warning' | 'critical' };

export function quotaSnapshot(used: number | null, limit: number | null, remaining?: number | null): QuotaSnapshot {
  if (used == null || limit == null) return { state: 'unknown' };
  if (![used, limit].every(value => Number.isFinite(value) && value >= 0)) return { state: 'invalid' };
  const expected = Math.max(0, limit - used);
  if (remaining != null && (!Number.isFinite(remaining) || remaining < 0 || Math.abs(remaining - expected) > 0.000001)) return { state: 'invalid' };
  const percentage = limit > 0 ? Math.min(used / limit * 100, 100) : used > 0 ? 100 : 0;
  return { state: 'known', used, limit, remaining: remaining ?? expected, percentage,
    tone: limit === 0 || percentage > 95 ? 'critical' : percentage >= 80 ? 'warning' : 'normal' };
}
