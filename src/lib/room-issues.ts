import type { useTranslations } from 'next-intl';
import type { RowIssue } from './types';

type RoomsTranslator = ReturnType<typeof useTranslations>;

/**
 * Translates a bulk/import row issue into "{field label}: {message}" —
 * shared between AddRoomsModal's bulk-range preview (11.3) and
 * ImportRoomsModal's Excel-import preview (11.7). The message resolves the
 * backend's stable issue code through `excel.import.issue.<CODE>` when a
 * translation exists; otherwise the raw code is shown so nothing is silently
 * swallowed. Caller must pass a `useTranslations('rooms')` translator.
 */
export function roomIssueMessage(t: RoomsTranslator, issue: RowIssue): string {
  const message = t.has(`excel.import.issue.${issue.code}`)
    ? t(`excel.import.issue.${issue.code}`)
    : issue.code;
  return t(`excel.import.rowError.${issue.field}`, { message });
}
