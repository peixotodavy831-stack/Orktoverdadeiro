const SENSITIVE_KEY = /password|authorization|cookie|(?:access|refresh|id)[_-]?token|service[_-]?role|admin[_-]?key|api[_-]?key|secret|credential|private[_-]?key|provider[_-]?payload/i;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const INLINE_SECRET = /((?:password|authorization|cookie|access[_-]?token|refresh[_-]?token|api[_-]?key|secret)\s*[:=]\s*)([^\s,;]+)/gi;

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (typeof value === 'string') {
    return value
      .replace(BEARER, 'Bearer [REDACTED]')
      .replace(JWT, '[JWT_REDACTED]')
      .replace(INLINE_SECRET, '$1[REDACTED]')
      .slice(0, 4000);
  }
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redactSensitiveData(item, depth + 1));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 200)) {
      result[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSensitiveData(entry, depth + 1);
    }
    return result;
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function logStructured(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}): void {
  const record = redactSensitiveData({ timestamp: new Date().toISOString(), event, ...fields }) as Record<string, unknown>;
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
