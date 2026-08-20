'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Code } from '@/components/ui';
import type { AvailableRoom } from '@/lib/types';

/**
 * The check-in / change-room picker (13.1 AC1): available `active` rooms
 * only, grouped by floor, searchable. Radio-style selection via
 * `aria-pressed` buttons — front desk uses tablets, so targets stay large.
 */
export function RoomPicker({
  rooms,
  value,
  onChange,
  error,
}: {
  rooms: AvailableRoom[];
  value: string | null;
  onChange: (roomId: string) => void;
  error?: string;
}) {
  const t = useTranslations('stays.checkin.room');
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const term = search.trim().toUpperCase();
    const filtered = term
      ? rooms.filter((room) => room.roomNumber.toUpperCase().includes(term))
      : rooms;
    const result: { key: string; rooms: AvailableRoom[] }[] = [];
    for (const room of filtered) {
      const key = room.floor === null ? 'none' : String(room.floor);
      const group = result.find((g) => g.key === key);
      if (group) group.rooms.push(room);
      else result.push({ key, rooms: [room] });
    }
    return result;
  }, [rooms, search]);

  if (rooms.length === 0) {
    return <p className="text-sm text-ink-soft">{t('noRooms')}</p>;
  }

  return (
    <div>
      <div className="relative">
        <Search
          size={15}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
          aria-hidden
        />
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAria')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-line bg-white py-2 pe-3 ps-9 text-sm text-ink"
        />
      </div>

      <div className="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-lg border border-line p-3">
        {groups.length === 0 ? (
          <p className="text-sm text-ink-soft">{t('empty')}</p>
        ) : (
          groups.map(({ key: floorKey, rooms: floorRooms }) => (
            <div key={floorKey}>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                {floorKey === 'none'
                  ? t('noFloor')
                  : t('floor', { floor: floorKey })}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {floorRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    aria-pressed={value === room.id}
                    onClick={() => onChange(room.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      value === room.id
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-white text-ink hover:border-ink'
                    }`}
                  >
                    <Code
                      className={value === room.id ? 'text-white' : undefined}
                    >
                      {room.roomNumber}
                    </Code>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-ink-soft">{t('hint')}</p>
    </div>
  );
}
