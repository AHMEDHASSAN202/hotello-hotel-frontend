'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { InfoTip } from '@/components/guidance';
import {
  Badge,
  Button,
  Code,
  ErrorState,
  Modal,
  Skeleton,
} from '@/components/ui';
import { api, ApiError, apiBlob, saveBlob } from '@/lib/api';
import { useFormatters } from '@/i18n/use-format';
import { useApiError } from '@/lib/errors';
import type { Room, RoomDetail } from '@/lib/types';

/**
 * Story 11.5 AC3/AC4 — per-room QR: the guest-facing preview, its raw URL
 * (copyable), and PNG/SVG downloads. Opens driven by `room` (rooms/page.tsx
 * sets `qrRoom`); loads the PNG preview + `RoomDetail.guestUrl` together on
 * open. The already-fetched PNG blob is reused for the PNG download button —
 * only SVG triggers a second network call.
 */
export function RoomQrModal({
  room,
  onClose,
}: {
  room: Room | null;
  onClose: () => void;
}) {
  const t = useTranslations('rooms.qr');
  const tRooms = useTranslations('rooms');
  const tG = useTranslations('guidance.rooms');
  const resolveError = useApiError();
  const { formatDate } = useFormatters();

  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [pngFilename, setPngFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'png' | 'svg' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // The room a user most recently asked for. `rooms/page.tsx` sets `qrRoom`
  // directly from each row's icon, so the modal can swap target rooms
  // without ever closing — a slower first request must not be allowed to
  // overwrite a faster second request's state after the fact (stale-response
  // guard, checked before every state commit in `load()`).
  const latestRoomIdRef = useRef<string | null>(null);

  const revokeImg = useCallback(() => {
    setImgUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const load = useCallback(
    async (roomId: string) => {
      setLoading(true);
      setLoadError(null);
      setDownloadError(null);
      try {
        const [detailRes, qrRes] = await Promise.all([
          api<RoomDetail>(`/tenant/rooms/${roomId}`),
          apiBlob(`/tenant/rooms/${roomId}/qr?format=png`),
        ]);
        // Stale-response guard: bail before committing anything if the user
        // has since switched to a different room's QR. We deliberately never
        // create an object URL for a discarded response (`URL.createObjectURL`
        // below is skipped), so there's nothing to revoke for the blob this
        // call fetched — only the previously-committed room's URL is ever
        // revoked, and only once a genuinely current response replaces it.
        if (latestRoomIdRef.current !== roomId) return;
        setDetail(detailRes);
        setPngBlob(qrRes.blob);
        setPngFilename(qrRes.filename);
        revokeImg();
        setImgUrl(URL.createObjectURL(qrRes.blob));
      } catch (err) {
        if (latestRoomIdRef.current !== roomId) return;
        setLoadError(
          err instanceof ApiError ? resolveError(err) : t('modal.loadError'),
        );
      } finally {
        if (latestRoomIdRef.current === roomId) {
          setLoading(false);
        }
      }
    },
    [resolveError, t, revokeImg],
  );

  // Load on open / room change; reset + revoke the object URL when the modal
  // closes (room becomes null) so nothing lingers between rooms. Updating the
  // ref here — synchronously, before `load()` ever awaits anything — is what
  // makes the guard inside `load()` correct: by the time any in-flight
  // request's await resolves, the ref already reflects whichever room is
  // actually current.
  useEffect(() => {
    latestRoomIdRef.current = room?.id ?? null;
    if (room) {
      load(room.id);
    } else {
      revokeImg();
      setDetail(null);
      setPngBlob(null);
      setPngFilename(null);
      setLoadError(null);
      setDownloadError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // Belt-and-braces revoke on unmount.
  useEffect(() => () => revokeImg(), [revokeImg]);

  async function handleDownload(format: 'png' | 'svg') {
    if (!room) return;
    setDownloading(format);
    setDownloadError(null);
    try {
      if (format === 'png' && pngBlob) {
        saveBlob(pngBlob, pngFilename ?? `room-${room.roomNumber}-qr.png`);
        return;
      }
      const { blob, filename } = await apiBlob(
        `/tenant/rooms/${room.id}/qr?format=${format}`,
      );
      saveBlob(blob, filename ?? `room-${room.roomNumber}-qr.${format}`);
    } catch (err) {
      setDownloadError(
        err instanceof ApiError ? resolveError(err) : t('modal.downloadError'),
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Modal
      open={room !== null}
      onClose={onClose}
      title={room ? t('modal.title', { roomNumber: room.roomNumber }) : ''}
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="mx-auto h-48 w-48" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : loadError ? (
        <ErrorState
          message={loadError}
          onRetry={() => room && load(room.id)}
        />
      ) : (
        room && (
          <div className="space-y-4">
            <div className="flex justify-center">
              {imgUrl && (
                <img
                  src={imgUrl}
                  alt={t('modal.imgAlt', { roomNumber: room.roomNumber })}
                  className="h-48 w-48 rounded-lg border border-line bg-white p-2"
                />
              )}
            </div>

            <div>
              <span className="mb-1 flex items-center gap-1">
                <span className="text-sm font-medium text-ink">
                  {t('modal.guestUrlLabel')}
                </span>
                <InfoTip label={t('modal.guestUrlLabel')}>
                  {tG('qrStable')}
                </InfoTip>
              </span>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2">
                <Code className="min-w-0 truncate text-xs text-ink">
                  {detail?.guestUrl}
                </Code>
                {detail && <CopyButton value={detail.guestUrl} />}
              </div>
            </div>

            {/* 13.2 AC3 / note 6 — the room's current stay, present only
                when the viewer holds stays.read (API omits it otherwise). */}
            {detail?.currentStay !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <Badge tone={detail?.currentStay ? 'gold' : 'neutral'}>
                  {tRooms(
                    detail?.currentStay
                      ? 'occupancy.occupied'
                      : 'occupancy.vacant',
                  )}
                </Badge>
                {detail?.currentStay && (
                  <span className="text-ink-soft">
                    {tRooms('occupancy.tip', {
                      guest: detail.currentStay.guestName,
                      date: formatDate(detail.currentStay.checkOutDate),
                    })}
                  </span>
                )}
              </div>
            )}

            {downloadError && (
              <div
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              >
                {downloadError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                loading={downloading === 'svg'}
                onClick={() => handleDownload('svg')}
              >
                {t('downloadSvg')}
              </Button>
              <Button
                loading={downloading === 'png'}
                onClick={() => handleDownload('png')}
              >
                {t('downloadPng')}
              </Button>
            </div>
          </div>
        )
      )}
    </Modal>
  );
}
