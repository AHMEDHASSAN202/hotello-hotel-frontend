'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ConciergeBell,
  Dumbbell,
  Pencil,
  ScrollText,
} from 'lucide-react';
import { Badge, Button, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { useTenant } from '@/components/tenant-provider';
import type { InfoEntryManage } from '@/lib/types';

export type RepeatableSection = 'facilities' | 'services' | 'house_rules';

const SECTION_ICONS = {
  facilities: Dumbbell,
  services: ConciergeBell,
  house_rules: ScrollText,
} as const;

/**
 * 17.1 AC3 — one repeatable section: rows with reorder (full-id-array POST,
 * the Epic 15 catalog pattern), per-entry active toggle, edit via modal.
 */
export function SectionBlock({
  section,
  entries,
  onAdd,
  onEdit,
  onChanged,
}: {
  section: RepeatableSection;
  entries: InfoEntryManage[];
  onAdd: () => void;
  onEdit: (entry: InfoEntryManage) => void;
  onChanged: () => void;
}) {
  const t = useTranslations('hotelInfo');
  const locale = useLocale();
  const { readOnly } = useTenant();
  const resolveError = useApiError();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const nameFor = (names: { ar?: string; en?: string }) =>
    (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '';

  async function mutate(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setRowError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setRowError(resolveError(err));
    } finally {
      setBusyId(null);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const ids = entries.map((e) => e.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void mutate(entries[index].id, () =>
      api(`/tenant/hotel-info/sections/${section}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ entryIds: ids }),
      }),
    );
  }

  const Icon = SECTION_ICONS[section];

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-gold" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-ink">
            {t(`sections.${section}.title`)}
          </h2>
        </div>
        <Button
          variant="ghost"
          onClick={onAdd}
          disabled={readOnly}
          title={readOnly ? t('readOnlyHint') : undefined}
        >
          {t(`sections.${section}.add`)}
        </Button>
      </div>
      {rowError && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {rowError}
        </p>
      )}
      {entries.length === 0 ? (
        <EmptyState
          icon={<Icon size={28} />}
          title={t(`sections.${section}.empty`)}
          hint={t(`sections.${section}.emptyHint`)}
          action={
            <Button onClick={onAdd} disabled={readOnly}>
              {t(`sections.${section}.add`)}
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className={`flex items-center gap-3 py-3 ${entry.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex flex-col">
                <button
                  aria-label={t('row.moveUp')}
                  disabled={index === 0 || readOnly || busyId !== null}
                  onClick={() => move(index, -1)}
                  className="rounded p-1 text-ink-soft hover:bg-paper disabled:opacity-30"
                >
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  aria-label={t('row.moveDown')}
                  disabled={
                    index === entries.length - 1 || readOnly || busyId !== null
                  }
                  onClick={() => move(index, 1)}
                  className="rounded p-1 text-ink-soft hover:bg-paper disabled:opacity-30"
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {nameFor(entry.names)}
                </p>
                {!entry.isActive && (
                  <Badge tone="neutral">{t('row.inactive')}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                loading={busyId === entry.id}
                disabled={readOnly}
                title={readOnly ? t('readOnlyHint') : undefined}
                onClick={() =>
                  mutate(entry.id, () =>
                    api(`/tenant/hotel-info/entries/${entry.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ isActive: !entry.isActive }),
                    }),
                  )
                }
              >
                {entry.isActive ? t('row.deactivate') : t('row.activate')}
              </Button>
              <button
                aria-label={t('row.edit')}
                onClick={() => onEdit(entry)}
                className="rounded p-1.5 text-ink-soft hover:bg-paper"
              >
                <Pencil size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
