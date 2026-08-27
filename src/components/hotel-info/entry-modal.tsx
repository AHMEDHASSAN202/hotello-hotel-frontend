'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequiredNote } from '@/components/guidance';
import { HoursEditor } from '@/components/hours-editor';
import {
  fieldsToPayload,
  NameFields,
  NameFieldValues,
  namesToFields,
} from '@/components/name-fields';
import { isValidPhoto, PhotoPicker } from '@/components/photo-picker';
import { Button, Field, Modal } from '@/components/ui';
import { api, apiUpload, assetUrl } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { FnbWindow, InfoEntryManage } from '@/lib/types';
import type { RepeatableSection } from './section-block';

/**
 * 17.1 AC1/AC2 — the repeatable-entry editor, section-aware: facilities get
 * hours + location note + a photo; services get how-to + price note; rules
 * are name + description only. Photo rides after save (two-phase, the F&B
 * pattern — entity first, then upload to its id).
 */
export function EntryModal({
  open,
  section,
  entry,
  onClose,
  onSaved,
}: {
  open: boolean;
  section: RepeatableSection;
  entry: InfoEntryManage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('hotelInfo.entryModal');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();

  const [names, setNames] = useState<NameFieldValues>({});
  const [windows, setWindows] = useState<FnbWindow[]>([]);
  const [aux, setAux] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNames(namesToFields(entry?.names, entry?.descriptions));
    setWindows(entry?.structured.windows ?? []);
    setAux({
      locationNoteEn: entry?.structured.locationNote?.en ?? '',
      locationNoteAr: entry?.structured.locationNote?.ar ?? '',
      howToEn: entry?.structured.howTo?.en ?? '',
      howToAr: entry?.structured.howTo?.ar ?? '',
      priceNoteEn: entry?.structured.priceNote?.en ?? '',
      priceNoteAr: entry?.structured.priceNote?.ar ?? '',
    });
    setIsActive(entry?.isActive ?? true);
    setPhotoFile(null);
    setPhotoError(null);
    setRemovePhoto(false);
    setError(null);
  }, [open, entry]);

  function pickPhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (!isValidPhoto(file)) {
      setPhotoError(t('photoInvalid'));
      return;
    }
    setPhotoFile(file);
    setRemovePhoto(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        ...fieldsToPayload(names, true),
        isActive,
      };
      if (section === 'facilities') {
        body.windows = windows;
        body.locationNoteEn = aux.locationNoteEn?.trim() ?? '';
        body.locationNoteAr = aux.locationNoteAr?.trim() ?? '';
      }
      if (section === 'services') {
        body.howToEn = aux.howToEn?.trim() ?? '';
        body.howToAr = aux.howToAr?.trim() ?? '';
        body.priceNoteEn = aux.priceNoteEn?.trim() ?? '';
        body.priceNoteAr = aux.priceNoteAr?.trim() ?? '';
      }
      const saved = entry
        ? await api<InfoEntryManage>(`/tenant/hotel-info/entries/${entry.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await api<InfoEntryManage>('/tenant/hotel-info/entries', {
            method: 'POST',
            body: JSON.stringify({ ...body, section }),
          });
      if (section === 'facilities') {
        if (photoFile) {
          if (entry?.photos[0]) {
            await api(
              `/tenant/hotel-info/entries/${saved.id}/photos/${entry.photos[0].id}`,
              { method: 'DELETE' },
            );
          }
          const formData = new FormData();
          formData.append('file', photoFile);
          await apiUpload(
            `/tenant/hotel-info/entries/${saved.id}/photos`,
            formData,
          );
        } else if (removePhoto && entry?.photos[0]) {
          await api(
            `/tenant/hotel-info/entries/${saved.id}/photos/${entry.photos[0].id}`,
            { method: 'DELETE' },
          );
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  }

  const currentPhoto =
    !removePhoto && !photoFile && entry?.photos[0]
      ? assetUrl(entry.photos[0].thumbUrl)
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? t(`editTitle.${section}`) : t(`createTitle.${section}`)}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <NameFields
          values={names}
          onChange={(k, v) => setNames((s) => ({ ...s, [k]: v }))}
          withDescriptions
          namespace="hotelInfo.names"
        />

        {section === 'facilities' ? (
          <>
            <HoursEditor
              value={windows}
              onChange={setWindows}
              namespace="hotelInfo.entryModal"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('locationNoteEn')}
                hint={t('locationNoteHelp')}
                value={aux.locationNoteEn ?? ''}
                onChange={(e) =>
                  setAux((s) => ({ ...s, locationNoteEn: e.target.value }))
                }
              />
              <Field
                label={t('locationNoteAr')}
                dir="rtl"
                value={aux.locationNoteAr ?? ''}
                onChange={(e) =>
                  setAux((s) => ({ ...s, locationNoteAr: e.target.value }))
                }
              />
            </div>
            <PhotoPicker
              label={t('photo')}
              currentUrl={currentPhoto}
              pending={photoFile}
              canRemove={Boolean(entry?.photos[0] && !removePhoto)}
              uploadLabel={t('photoUpload')}
              replaceLabel={t('photoReplace')}
              removeLabel={t('photoRemove')}
              error={photoError}
              onPick={pickPhoto}
              onRemove={() => {
                setRemovePhoto(true);
                setPhotoFile(null);
              }}
            />
          </>
        ) : null}

        {section === 'services' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('howToEn')}
                hint={t('howToHelp')}
                value={aux.howToEn ?? ''}
                onChange={(e) =>
                  setAux((s) => ({ ...s, howToEn: e.target.value }))
                }
              />
              <Field
                label={t('howToAr')}
                dir="rtl"
                value={aux.howToAr ?? ''}
                onChange={(e) =>
                  setAux((s) => ({ ...s, howToAr: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('priceNoteEn')}
                hint={t('priceNoteHelp')}
                value={aux.priceNoteEn ?? ''}
                onChange={(e) =>
                  setAux((s) => ({ ...s, priceNoteEn: e.target.value }))
                }
              />
              <Field
                label={t('priceNoteAr')}
                dir="rtl"
                value={aux.priceNoteAr ?? ''}
                onChange={(e) =>
                  setAux((s) => ({ ...s, priceNoteAr: e.target.value }))
                }
              />
            </div>
          </>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t('visible')}
        </label>

        <RequiredNote />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={!names.nameEn?.trim() || !names.nameAr?.trim()}
          >
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
