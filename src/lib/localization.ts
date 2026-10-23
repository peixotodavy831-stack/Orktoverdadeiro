export const DEFAULT_LOCALE = 'pt-BR' as const;
export const SUPPORTED_LOCALES = ['pt-BR', 'en-US', 'es-419'] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/** Map browser/profile language tags to the small set of reviewed locale formats. */
export function resolveLocale(value: unknown): SupportedLocale {
  if (typeof value !== 'string') return DEFAULT_LOCALE;
  const language = value.trim().toLowerCase().split(/[-_]/, 1)[0];
  if (language === 'en') return 'en-US';
  if (language === 'es') return 'es-419';
  return DEFAULT_LOCALE;
}

export function formatLocaleNumber(value: number, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatLocaleCurrency(
  value: number,
  currency: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

/** Invalid dates stay unavailable; callers choose their own translated placeholder. */
export function formatLocaleDate(
  value: Date | string | number,
  locale: SupportedLocale = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'short' },
): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, options).format(date);
}
