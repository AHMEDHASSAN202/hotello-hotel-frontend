'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui';

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Client-side pre-check mirroring the backend photo rules (5 MB, no SVG). */
export function isValidPhoto(file: File): boolean {
  return PHOTO_TYPES.includes(file.type) && file.size <= PHOTO_MAX_BYTES;
}

/**
 * Single-photo picker (Epic 16.2), extracted in Epic 17 for reuse by the
 * hotel-info entry modal. Labels come in as strings so any namespace can
 * feed it. The pending file's preview object-URL is revoked on change and
 * unmount (leak fix over the inlined original).
 */
export function PhotoPicker({
  label,
  hint,
  currentUrl,
  pending,
  canRemove,
  uploadLabel,
  replaceLabel,
  removeLabel,
  error,
  disabled = false,
  onPick,
  onRemove,
}: {
  label: string;
  hint?: string;
  /** Existing stored photo (absolute URL), if any and not marked removed. */
  currentUrl: string | null;
  /** File picked this session, not yet uploaded. */
  pending: File | null;
  /** Show the remove action (an existing photo is removable). */
  canRemove: boolean;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  error: string | null;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);

  const pendingUrl = useMemo(
    () => (pending ? URL.createObjectURL(pending) : null),
    [pending],
  );
  useEffect(() => {
    return () => {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [pendingUrl]);

  const preview = pendingUrl ?? currentUrl;

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {hint ? <p className="mb-2 text-xs text-ink-soft">{hint}</p> : null}
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-16 w-20 rounded-lg border border-line object-cover"
          />
        ) : (
          <span className="flex h-16 w-20 items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-soft">
            {label}
          </span>
        )}
        <div className="flex flex-col gap-1">
          <input
            ref={fileInput}
            type="file"
            accept={PHOTO_TYPES.join(',')}
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
          >
            {preview ? replaceLabel : uploadLabel}
          </Button>
          {canRemove ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className="text-sm text-danger underline-offset-2 hover:underline"
            >
              {removeLabel}
            </button>
          ) : null}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
