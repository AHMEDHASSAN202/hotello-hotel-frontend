'use client';

import { useTranslations } from 'next-intl';
import { scorePassword, type StrengthLevel } from './password-strength';

const barColor: Record<StrengthLevel, string> = {
  empty: 'bg-line',
  weak: 'bg-danger',
  fair: 'bg-amber-500',
  good: 'bg-gold',
  strong: 'bg-success',
};

const filledBars: Record<StrengthLevel, number> = {
  empty: 0,
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

/**
 * Strength meter with localized labels. Purely advisory — the actual policy
 * (min 8 + letter + digit) is enforced by isPasswordValid at submit time.
 */
export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations('auth.password');
  const { level } = scorePassword(password);
  const filled = filledBars[level];

  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < filled ? barColor[level] : 'bg-line'
            }`}
          />
        ))}
      </div>
      {level !== 'empty' && (
        <p className="mt-1 text-xs text-ink-soft">
          {t('strength.label')}:{' '}
          <span className="font-medium text-ink">{t(`strength.${level}`)}</span>
        </p>
      )}
    </div>
  );
}
