'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import type { Locale } from './config';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from './format';

/**
 * Locale-bound formatting helpers for client components. Reads the active
 * locale from next-intl so screens never thread it manually.
 */
export function useFormatters() {
  const locale = useLocale() as Locale;

  return {
    locale,
    formatNumber: useCallback(
      (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
      [locale],
    ),
    formatCurrency: useCallback(
      (value: number, currency?: string, options?: Intl.NumberFormatOptions) =>
        formatCurrency(value, locale, currency, options),
      [locale],
    ),
    formatDate: useCallback(
      (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, locale, options),
      [locale],
    ),
    formatDateTime: useCallback(
      (value: Date | string | number) => formatDateTime(value, locale),
      [locale],
    ),
    formatRelativeTime: useCallback(
      (value: Date | string | number, now?: Date | number) =>
        formatRelativeTime(value, locale, now),
      [locale],
    ),
  };
}
