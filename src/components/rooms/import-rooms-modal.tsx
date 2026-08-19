'use client';

import { FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { api, apiBlob, apiUpload, ApiError, saveBlob } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { roomIssueMessage } from '@/lib/room-issues';
import type { BulkCreateResponse, BulkPreview } from '@/lib/types';

type Step = 'file' | 'preview' | 'success';

/** Mirrors the backend's 2MB upload cap (`rooms/import/preview`) — kept in
 * sync manually since the two repos don't share constants. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Story 11.7 — Excel import. Mirrors AddRoomsModal's bulk-range preview →
 * confirm flow (11.3): step 1 picks + client-validates a .xlsx file (with a
 * "Download template" shortcut and a guidance note), step 2 is the same
 * "skip invalid/duplicate rows and import the rest" preview/confirm
 * contract as the bulk range, step 3 is a one-line created/skipped note
 * before the caller reloads the list.
 */
export function ImportRoomsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const t = useTranslations('rooms');
  const tCommon = useTranslations('common');
  const tG = useTranslations('guidance.rooms');
  const resolveError = useApiError();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('file');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmErrorRemaining, setConfirmErrorRemaining] = useState<
    number | null
  >(null);

  const [result, setResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setStep('file');
      setFile(null);
      setFileError(null);
      setUploading(false);
      setTemplateDownloading(false);
      setTemplateError(null);
      setPreview(null);
      setConfirming(false);
      setConfirmError(null);
      setConfirmErrorRemaining(null);
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  /** Returns the file input + preview step to a clean, retryable state —
   * used both after a client-side rejection and a server-side one. */
  function resetFileSelection() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /** Same translated copy the backend's IMPORT_FILE_INVALID uses — resolved
   * through the shared error map so client- and server-side rejections read
   * identically. */
  function invalidFileMessage(): string {
    return resolveError(
      new ApiError(400, 'Invalid file', undefined, 'IMPORT_FILE_INVALID'),
    );
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFileError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    const validExtension = picked.name.toLowerCase().endsWith('.xlsx');
    if (!validExtension || picked.size > MAX_FILE_BYTES) {
      setFileError(invalidFileMessage());
      resetFileSelection();
      return;
    }
    setFile(picked);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setFileError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiUpload<BulkPreview>(
        '/tenant/rooms/import/preview',
        formData,
      );
      setPreview(res);
      setStep('preview');
    } catch (err) {
      setFileError(resolveError(err));
      resetFileSelection();
    } finally {
      setUploading(false);
    }
  }

  async function handleDownloadTemplate() {
    setTemplateDownloading(true);
    setTemplateError(null);
    try {
      const { blob, filename } = await apiBlob('/tenant/rooms/import/template');
      saveBlob(blob, filename ?? 'room-import-template.xlsx');
    } catch (err) {
      setTemplateError(resolveError(err));
    } finally {
      setTemplateDownloading(false);
    }
  }

  /** Shared 409 ROOM_LIMIT_REACHED handling — mirrors AddRoomsModal's
   * applyLimitError (11.3 AC3). */
  function applyLimitError(err: ApiError) {
    setConfirmError(resolveError(err));
    const remaining = (err.details as { remaining?: number } | undefined)
      ?.remaining;
    setConfirmErrorRemaining(typeof remaining === 'number' ? remaining : null);
  }

  async function handleConfirm() {
    if (!preview) return;
    // Confirming always means "skip invalid/duplicate rows and import the
    // rest" (mirrors 11.3 AC2) — only valid, non-duplicate rows are posted.
    const included = preview.rows.filter(
      (r) => !r.duplicate && r.issues.length === 0,
    );
    setConfirming(true);
    setConfirmError(null);
    setConfirmErrorRemaining(null);
    try {
      const res = await api<BulkCreateResponse>('/tenant/rooms/bulk', {
        method: 'POST',
        body: JSON.stringify({
          rooms: included.map((r) => ({
            row: r.row,
            roomNumber: r.roomNumber,
            floor: r.floor,
            roomTypeId: r.roomTypeId,
            status: r.status,
          })),
          source: 'import',
          skipDuplicates: true,
          skippedCount: preview.rows.length - included.length,
        }),
      });
      onImported();
      setResult({
        created: res?.created ?? included.length,
        skipped: res?.skipped ?? preview.rows.length - included.length,
      });
      setStep('success');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROOM_LIMIT_REACHED') {
        applyLimitError(err);
      } else {
        setConfirmError(resolveError(err));
      }
    } finally {
      setConfirming(false);
    }
  }

  const hasIssues = preview?.rows.some((r) => r.issues.length > 0) ?? false;

  return (
    <Modal open={open} onClose={onClose} title={t('excel.import.title')} wide>
      {step === 'file' && (
        <div className="space-y-4">
          <p className="text-xs text-ink-soft">{tG('importNote')}</p>

          {fileError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {fileError}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {t('excel.import.dropzone')}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              disabled={uploading}
              onChange={handleFileChange}
              className="block w-full rounded-lg border border-dashed border-line bg-paper px-3 py-6 text-sm text-ink-soft file:me-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
          </label>
          {file && (
            <p className="text-xs text-ink-soft">
              {t('excel.import.chosenFile', { name: file.name })}
            </p>
          )}

          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDownloadTemplate}
              loading={templateDownloading}
            >
              <FileSpreadsheet size={15} aria-hidden />{' '}
              {templateDownloading
                ? t('excel.templateDownloading')
                : t('excel.template')}
            </Button>
            {templateError && (
              <p className="mt-2 text-xs text-danger">{templateError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file}
              loading={uploading}
            >
              {uploading ? t('excel.import.uploading') : t('form.preview.title')}
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <p className="text-xs text-ink-soft">{tG('bulkPreviewNote')}</p>

          <div className="rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-ink">
            <p className="font-semibold">
              {t('form.preview.validCount', { count: preview.validCount })}
            </p>
            <p className="mt-1">
              {preview.remaining === null
                ? t('form.preview.unlimited')
                : t('form.preview.remaining', { count: preview.remaining })}
            </p>
            {preview.duplicateCount > 0 && (
              <p className="mt-1">
                {t('form.preview.duplicateCount', {
                  count: preview.duplicateCount,
                })}
              </p>
            )}
            {preview.invalidCount > 0 && (
              <p className="mt-1">
                {t('form.preview.invalidCount', {
                  count: preview.invalidCount,
                })}
              </p>
            )}
          </div>

          {hasIssues && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-line bg-paper p-3">
              <ul className="space-y-1 text-xs text-danger">
                {preview.rows
                  .filter((r) => r.issues.length > 0)
                  .flatMap((r) =>
                    r.issues.map((issue, i) => (
                      <li key={`${r.row}-${issue.field}-${i}`}>
                        {t('excel.import.rowLine', {
                          row: r.row,
                          detail: roomIssueMessage(t, issue),
                        })}
                      </li>
                    )),
                  )}
              </ul>
            </div>
          )}

          {confirmError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              <p>{confirmError}</p>
              {confirmErrorRemaining !== null && (
                <p className="mt-1">
                  {t('form.preview.remaining', {
                    count: confirmErrorRemaining,
                  })}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              disabled={preview.validCount === 0}
              loading={confirming}
              onClick={handleConfirm}
            >
              {confirming
                ? t('excel.import.confirming')
                : t('excel.import.confirm', { count: preview.validCount })}
            </Button>
          </div>
        </div>
      )}

      {step === 'success' && result && (
        <div className="space-y-4">
          <p className="text-sm text-ink">
            {t('excel.import.success', {
              created: result.created,
              skipped: result.skipped,
            })}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              {tCommon('actions.done')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
