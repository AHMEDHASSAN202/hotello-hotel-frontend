'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { Button, Field, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { FnbMenuManage, FnbWindow, StayType } from '@/lib/types';
import { STAY_TYPES } from '@/lib/types';
import {
  fieldsToPayload,
  NameFields,
  NameFieldValues,
  namesToFields,
} from '@/components/name-fields';
import { HoursEditor } from '@/components/hours-editor';

/**
 * 16.2 AC1 — menu editor: 7-locale names, availability windows (overnight
 * fine, empty = always), prep SLA, menu-level pricing default (AC3), active.
 */
export function MenuModal({
  menu,
  open,
  onClose,
  onSaved,
}: {
  menu: FnbMenuManage | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('fnb.menus.menuModal');
  const tStayTypes = useTranslations('stays.stayTypes');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();

  const [names, setNames] = useState<NameFieldValues>({});
  const [windows, setWindows] = useState<FnbWindow[]>([]);
  const [prepSla, setPrepSla] = useState('30');
  const [includedMode, setIncludedMode] = useState<'paid' | 'included'>('paid');
  const [includedFor, setIncludedFor] = useState<StayType[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNames(namesToFields(menu?.names, menu?.descriptions));
    setWindows(menu?.windows ?? []);
    setPrepSla(String(menu?.prepSlaMinutes ?? 30));
    setIncludedMode((menu?.defaultIncludedFor?.length ?? 0) > 0 ? 'included' : 'paid');
    setIncludedFor(menu?.defaultIncludedFor ?? []);
    setIsActive(menu?.isActive ?? true);
    setError(null);
  }, [open, menu]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...fieldsToPayload(names, true),
        windows,
        prepSlaMinutes: Number(prepSla),
        defaultIncludedFor: includedMode === 'included' ? includedFor : [],
        isActive,
      };
      if (menu) {
        await api(`/tenant/fnb-menus/${menu.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await api('/tenant/fnb-menus', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={menu ? t('editTitle') : t('createTitle')}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <NameFields values={names} onChange={(k, v) => setNames((s) => ({ ...s, [k]: v }))} withDescriptions />

        <HoursEditor
          value={windows}
          onChange={setWindows}
          namespace="fnb.menus.menuModal"
        />

        <Field
          label={t('prepSlaLabel')}
          hint={t('prepSlaHint')}
          type="number"
          min={5}
          max={240}
          required
          value={prepSla}
          onChange={(e) => setPrepSla(e.target.value)}
        />

        {/* 16.2 AC3 — the menu-level pricing default */}
        <div>
          <span className="mb-1 block text-sm font-medium text-ink">
            {t('pricingLabel')}
          </span>
          <p className="mb-2 text-xs text-ink-soft">{t('pricingHint')}</p>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="menu-pricing"
                checked={includedMode === 'paid'}
                onChange={() => setIncludedMode('paid')}
              />
              {t('pricingPaid')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="menu-pricing"
                checked={includedMode === 'included'}
                onChange={() => setIncludedMode('included')}
              />
              {t('pricingIncluded')}
            </label>
          </div>
          {includedMode === 'included' ? (
            <div className="mt-2 flex flex-wrap gap-3">
              {STAY_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={includedFor.includes(type)}
                    onChange={(e) =>
                      setIncludedFor((prev) =>
                        e.target.checked
                          ? [...prev, type]
                          : prev.filter((x) => x !== type),
                      )
                    }
                  />
                  {tStayTypes(type)}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t('activeLabel')}
        </label>

        <RequiredNote />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={!names.nameEn?.trim() || !names.nameAr?.trim()}
          >
            {menu ? t('save') : t('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
