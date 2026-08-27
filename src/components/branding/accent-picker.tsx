'use client';

import { useTranslations } from 'next-intl';
import { Button, Field } from '@/components/ui';
import {
  GXP_NAVY,
  isAccentAllowed,
  isHexColor,
  nearestSafeAccent,
} from '@/lib/contrast';

/**
 * Accent color knob (18.1 AC1). Contrast is enforced, not suggested: an
 * unreadable color renders a plain-language block plus a one-click
 * nearest-safe suggestion, and the parent disables Save while blocked —
 * the hotel picks the hue, the design system keeps it readable.
 */
export function AccentPicker({
  value,
  onChange,
  disabled,
}: {
  /** Hex value, or '' for the GXP default navy. */
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('branding.accent');
  const effective = isHexColor(value) ? value : GXP_NAVY;
  const blocked = value !== '' && isHexColor(value) && !isAccentAllowed(value);
  const suggestion = blocked ? nearestSafeAccent(value) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <input
          type="color"
          aria-label={t('label')}
          value={effective}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          disabled={disabled}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1 disabled:cursor-default"
        />
        <div className="min-w-0 flex-1">
          <Field
            label={t('hex')}
            value={value}
            placeholder={GXP_NAVY}
            maxLength={7}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            dir="ltr"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || value === ''}
          onClick={() => onChange('')}
        >
          {t('reset')}
        </Button>
      </div>
      <p className="text-sm text-ink-soft">{t('help')}</p>
      {blocked && suggestion ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-ink"
        >
          <p>{t('blocked')}</p>
          <button
            type="button"
            data-testid="accent-suggestion"
            disabled={disabled}
            onClick={() => onChange(suggestion)}
            className="mt-2 inline-flex items-center gap-2 font-semibold text-ink underline underline-offset-2"
          >
            <span
              aria-hidden
              className="inline-block h-4 w-4 rounded border border-line"
              style={{ background: suggestion }}
            />
            {t('useSuggestion', { hex: suggestion.toUpperCase() })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
