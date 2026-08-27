'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { Button, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { FnbSectionManage } from '@/lib/types';
import {
  fieldsToPayload,
  NameFields,
  NameFieldValues,
  namesToFields,
} from '@/components/name-fields';

/** 16.2 AC2 — section editor (Starters, Mains, Drinks…). */
export function SectionModal({
  menuId,
  section,
  open,
  onClose,
  onSaved,
}: {
  menuId: string;
  section: FnbSectionManage | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('fnb.menus.sectionModal');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();

  const [names, setNames] = useState<NameFieldValues>({});
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNames(namesToFields(section?.names));
    setIsActive(section?.isActive ?? true);
    setError(null);
  }, [open, section]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...fieldsToPayload(names, false), isActive };
      if (section) {
        await api(`/tenant/fnb-menus/sections/${section.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await api(`/tenant/fnb-menus/${menuId}/sections`, {
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
      title={section ? t('editTitle') : t('createTitle')}
    >
      <form onSubmit={submit} className="space-y-4">
        <NameFields
          values={names}
          onChange={(k, v) => setNames((s) => ({ ...s, [k]: v }))}
        />
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
            {section ? t('save') : t('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
