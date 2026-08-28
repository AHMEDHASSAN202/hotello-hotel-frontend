import type { AudienceFilter } from '@/lib/types';

/** Minimal shape of a next-intl translator bound to the announcements namespace. */
export type AudienceTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * 19.3 AC1 — the human audience summary ("All-Inclusive · Floors 2–3").
 * Combined dimensions join with a middot; a single-guest audience shows the
 * resolved guest label when the caller has one.
 */
export function audienceSummary(
  filter: AudienceFilter | null | undefined,
  t: AudienceTranslator,
  stayLabel?: string | null,
): string {
  if (filter?.stayId) return stayLabel ?? t('audience.guest');
  const parts: string[] = [];
  if (filter?.stayTypes?.length) {
    parts.push(filter.stayTypes.map((s) => t(`stayTypes.${s}`)).join(' · '));
  }
  if (filter?.floors?.length) {
    parts.push(
      [...filter.floors]
        .sort((a, b) => a - b)
        .map((floor) => t('audience.floorLabel', { floor }))
        .join(' · '),
    );
  }
  if (filter?.roomIds?.length) {
    parts.push(t('audience.roomsCount', { count: filter.roomIds.length }));
  }
  return parts.length ? parts.join(' · ') : t('audience.everyone');
}
