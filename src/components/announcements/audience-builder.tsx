'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { InfoTip } from '@/components/guidance';
import { api } from '@/lib/api';
import {
  STAY_TYPES,
  type AudienceFilter,
  type Room,
  type RoomsListResponse,
  type Stay,
  type StayType,
} from '@/lib/types';

type Mode = 'everyone' | 'filtered' | 'guest';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Epic 19, Story 19.1 AC2-AC4 — the audience builder. Composable on purpose
 * (spec note 6): value in, filter out, fetches its own option data. Shows the
 * live recipient count ("سيصل إلى 62 ضيفًا حاليًا") — labeled "currently"
 * because the audience is a dynamic filter, not a snapshot (AC3).
 */
export function AudienceBuilder({
  value,
  onChange,
  disabled = false,
  stayLabel = null,
}: {
  value: AudienceFilter;
  onChange: (filter: AudienceFilter) => void;
  disabled?: boolean;
  /** Resolved "name — room" label when editing a single-guest audience. */
  stayLabel?: string | null;
}) {
  const t = useTranslations('announcements');
  const g = useTranslations('guidance.announcements');

  const [mode, setMode] = useState<Mode>(() =>
    value.stayId
      ? 'guest'
      : value.stayTypes?.length || value.floors?.length || value.roomIds?.length
        ? 'filtered'
        : 'everyone',
  );

  // Option data — rooms once (first 200; the picker also has a text filter).
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => {
    let cancelled = false;
    void api<RoomsListResponse>('/tenant/rooms?pageSize=200')
      .then((res) => {
        if (!cancelled) setRooms(res.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const floors = useMemo(
    () =>
      Array.from(
        new Set(rooms.map((r) => r.floor).filter((f): f is number => f !== null)),
      ).sort((a, b) => a - b),
    [rooms],
  );

  // Guest search (mode: one specific guest).
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<Stay[] | null>(null);
  const [selectedStay, setSelectedStay] = useState<Stay | null>(null);
  useEffect(() => {
    if (mode !== 'guest' || !guestQuery.trim()) {
      setGuestResults(null);
      return;
    }
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ view: 'active', search: guestQuery.trim() });
      void api<{ data: Stay[] }>(`/tenant/stays?${qs.toString()}`)
        .then((res) => setGuestResults(res.data))
        .catch(() => setGuestResults([]));
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mode, guestQuery]);

  // 19.1 AC2 — debounced live recipient count.
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const serialized = JSON.stringify(value);
  useEffect(() => {
    setCounting(true);
    const timer = setTimeout(() => {
      void api<{ count: number }>('/tenant/announcements/audience/preview', {
        method: 'POST',
        body: JSON.stringify({ audience: JSON.parse(serialized) }),
      })
        .then((res) => setCount(res.count))
        .catch(() => setCount(null))
        .finally(() => setCounting(false));
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [serialized]);

  const [roomFilter, setRoomFilter] = useState('');
  const visibleRooms = roomFilter.trim()
    ? rooms.filter((r) =>
        r.roomNumber.toLowerCase().includes(roomFilter.trim().toLowerCase()),
      )
    : rooms;

  function switchMode(next: Mode) {
    setMode(next);
    setSelectedStay(null);
    onChange({});
  }

  function toggle<T>(list: T[] | undefined, item: T): T[] {
    const current = list ?? [];
    return current.includes(item)
      ? current.filter((x) => x !== item)
      : [...current, item];
  }

  return (
    <div data-testid="audience-builder">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-ink">{t('audience.label')}</span>
        <InfoTip label={t('audience.label')}>{g('dynamicAudience')}</InfoTip>
      </div>

      <div role="radiogroup" aria-label={t('audience.label')} className="mt-2 flex flex-wrap gap-2">
        {(['everyone', 'filtered', 'guest'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mode === key}
            disabled={disabled}
            onClick={() => switchMode(key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              mode === key
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-ink-soft'
            }`}
          >
            {t(`audience.${key}`)}
          </button>
        ))}
      </div>

      {mode === 'filtered' ? (
        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              {t('audience.stayTypes')}
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {STAY_TYPES.map((stayType: StayType) => (
                <label key={stayType} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={value.stayTypes?.includes(stayType) ?? false}
                    onChange={() => {
                      const stayTypes = toggle(value.stayTypes, stayType);
                      onChange({
                        ...value,
                        stayTypes: stayTypes.length ? stayTypes : undefined,
                      });
                    }}
                  />
                  {t(`stayTypes.${stayType}`)}
                </label>
              ))}
            </div>
          </fieldset>

          {floors.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">
                {t('audience.floors')}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {floors.map((floor) => (
                  <label key={floor} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={value.floors?.includes(floor) ?? false}
                      onChange={() => {
                        const next = toggle(value.floors, floor);
                        onChange({
                          ...value,
                          floors: next.length ? next : undefined,
                        });
                      }}
                    />
                    {t('audience.floorLabel', { floor })}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              {t('audience.rooms')}
            </legend>
            <input
              type="search"
              disabled={disabled}
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              placeholder={t('audience.guestSearchPlaceholder')}
              className="mb-2 w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            />
            <div className="grid max-h-44 grid-cols-3 gap-x-3 gap-y-1.5 overflow-y-auto sm:grid-cols-4">
              {visibleRooms.map((room) => (
                <label key={room.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={value.roomIds?.includes(room.id) ?? false}
                    onChange={() => {
                      const next = toggle(value.roomIds, room.id);
                      onChange({
                        ...value,
                        roomIds: next.length ? next : undefined,
                      });
                    }}
                  />
                  {room.roomNumber}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {mode === 'guest' ? (
        <div className="mt-4">
          {value.stayId ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink">
              <Users size={16} className="text-ink-soft" />
              <span>
                {selectedStay
                  ? `${selectedStay.guestName} — ${selectedStay.roomNumber}`
                  : (stayLabel ?? t('audience.guest'))}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSelectedStay(null);
                  onChange({});
                }}
                className="ms-auto text-xs font-medium text-ink-soft underline-offset-2 hover:underline"
              >
                {t('audience.guestSearch')}
              </button>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">
                  {t('audience.guestSearch')}
                </span>
                <input
                  type="search"
                  disabled={disabled}
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                  placeholder={t('audience.guestSearchPlaceholder')}
                  className="w-full max-w-sm rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                />
              </label>
              {guestResults !== null ? (
                guestResults.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">
                    {t('audience.noMatches')}
                  </p>
                ) : (
                  <ul className="mt-2 max-h-44 max-w-sm space-y-1 overflow-y-auto">
                    {guestResults.map((stay) => (
                      <li key={stay.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setSelectedStay(stay);
                            onChange({ stayId: stay.id });
                          }}
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-start text-sm text-ink hover:bg-paper"
                        >
                          {stay.guestName} — {stay.roomNumber}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <p data-testid="audience-live-count" className="mt-4 text-sm font-medium text-ink">
        {counting || count === null
          ? t('audience.counting')
          : t('audience.liveCount', { count })}
      </p>
    </div>
  );
}
