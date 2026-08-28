'use client';

import { useTranslations } from 'next-intl';
import { InfoTip } from '@/components/guidance';
import { Field } from '@/components/ui';

/**
 * 19.2 AC1 — send now vs schedule, hotel-local. Values stay naked local
 * date/time strings joined as 'YYYY-MM-DD HH:MM' and are sent unconverted —
 * the backend interprets them in the hotel's timezone (house rule: never
 * `toISOString()` a hotel-local value).
 */
export interface ScheduleValue {
  mode: 'now' | 'schedule';
  publishDate: string;
  publishTime: string;
  untilDate: string;
  untilTime: string;
}

export const EMPTY_SCHEDULE: ScheduleValue = {
  mode: 'now',
  publishDate: '',
  publishTime: '',
  untilDate: '',
  untilTime: '',
};

/** 'YYYY-MM-DD HH:MM' stamp → the two inputs; used when editing. */
export function stampToParts(stamp: string | null): { date: string; time: string } {
  if (!stamp) return { date: '', time: '' };
  const [date, time] = stamp.split(' ');
  return { date: date ?? '', time: time ?? '' };
}

export function scheduleToPayload(v: ScheduleValue): {
  publishAtLocal?: string;
  activeUntilLocal?: string;
} {
  const payload: { publishAtLocal?: string; activeUntilLocal?: string } = {};
  if (v.mode === 'schedule' && v.publishDate && v.publishTime) {
    payload.publishAtLocal = `${v.publishDate} ${v.publishTime}`;
  }
  if (v.untilDate && v.untilTime) {
    payload.activeUntilLocal = `${v.untilDate} ${v.untilTime}`;
  }
  return payload;
}

export function scheduleComplete(v: ScheduleValue): boolean {
  if (v.mode === 'schedule' && (!v.publishDate || !v.publishTime)) return false;
  // active-until is optional but must be whole when started.
  if ((v.untilDate && !v.untilTime) || (!v.untilDate && v.untilTime)) return false;
  return true;
}

export function ScheduleFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('announcements.compose');
  const g = useTranslations('guidance.announcements');

  const set = (patch: Partial<ScheduleValue>) => onChange({ ...value, ...patch });

  return (
    <div>
      <div role="radiogroup" aria-label={t('timingTitle')} className="flex flex-wrap gap-2">
        {(['now', 'schedule'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value.mode === mode}
            disabled={disabled}
            onClick={() => set({ mode })}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              value.mode === mode
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-ink-soft'
            }`}
          >
            {mode === 'now' ? t('modeNow') : t('modeSchedule')}
          </button>
        ))}
      </div>

      {value.mode === 'schedule' ? (
        <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
          <Field
            label={t('publishDate')}
            type="date"
            required
            disabled={disabled}
            value={value.publishDate}
            onChange={(e) => set({ publishDate: e.target.value })}
          />
          <Field
            label={t('publishTime')}
            type="time"
            required
            disabled={disabled}
            value={value.publishTime}
            onChange={(e) => set({ publishTime: e.target.value })}
          />
        </div>
      ) : null}

      <div className="mt-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-ink">{t('activeUntil')}</span>
          <InfoTip label={t('activeUntil')}>{g('activeUntil')}</InfoTip>
        </div>
        <div className="mt-2 grid max-w-md grid-cols-2 gap-3">
          <Field
            label={t('activeUntilDate')}
            type="date"
            disabled={disabled}
            value={value.untilDate}
            onChange={(e) => set({ untilDate: e.target.value })}
          />
          <Field
            label={t('activeUntilTime')}
            type="time"
            disabled={disabled}
            value={value.untilTime}
            onChange={(e) => set({ untilTime: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
