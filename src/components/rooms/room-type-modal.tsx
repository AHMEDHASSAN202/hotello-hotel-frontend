'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { Button, Field, Modal } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { RoomType } from '@/lib/types';

interface FormState {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

const EMPTY_FORM: FormState = {
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
};

/**
 * Story 11.1 — create/edit room type. Mirrors the roles inline-modal pattern
 * (roles/page.tsx) as its own component. Mutation responses come back without
 * `roomsCount` (a raw entity), so the caller always reloads the list via
 * `onSaved` rather than trusting this response.
 */
export function RoomTypeModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: RoomType | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('rooms.types');
  const tCommon = useTranslations('common');
  const tG = useTranslations('guidance.rooms.types');
  const resolveError = useApiError();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    nameEn?: string;
    nameAr?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing === 'new') {
      setForm(EMPTY_FORM);
      setFormError(null);
      setFieldErrors({});
    } else if (editing) {
      setForm({
        nameEn: editing.nameEn,
        nameAr: editing.nameAr,
        descriptionEn: editing.descriptionEn ?? '',
        descriptionAr: editing.descriptionAr ?? '',
      });
      setFormError(null);
      setFieldErrors({});
    }
  }, [editing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload = {
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      descriptionEn: form.descriptionEn || undefined,
      descriptionAr: form.descriptionAr || undefined,
    };
    try {
      if (editing === 'new') {
        await api<RoomType>('/tenant/room-types', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (editing) {
        await api<RoomType>(`/tenant/room-types/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROOM_TYPE_NAME_TAKEN') {
        const field =
          (err.details as { field?: string })?.field === 'nameAr'
            ? 'nameAr'
            : 'nameEn';
        setFieldErrors({ [field]: resolveError(err) });
      } else {
        setFormError(resolveError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={editing !== null}
      onClose={onClose}
      title={editing === 'new' ? t('form.createTitle') : t('form.editTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {formError}
          </div>
        )}
        <Field
          label={t('form.nameEn')}
          required
          hint={tG('nameHelp')}
          error={fieldErrors.nameEn}
          value={form.nameEn}
          onChange={(e) => set('nameEn', e.target.value)}
        />
        <Field
          label={t('form.nameAr')}
          required
          dir="rtl"
          error={fieldErrors.nameAr}
          value={form.nameAr}
          onChange={(e) => set('nameAr', e.target.value)}
        />
        <Field
          label={t('form.descriptionEn')}
          hint={t('form.descriptionOptional')}
          value={form.descriptionEn}
          onChange={(e) => set('descriptionEn', e.target.value)}
        />
        <Field
          label={t('form.descriptionAr')}
          dir="rtl"
          value={form.descriptionAr}
          onChange={(e) => set('descriptionAr', e.target.value)}
        />
        <RequiredNote />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {editing === 'new' ? t('form.createSubmit') : t('form.saveSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
