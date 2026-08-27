'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { ModuleKey } from '@/lib/types';

/**
 * Locked-module upsell shell (18.3) — the reusable surface for premium
 * modules not in the hotel's plan (branding today, analytics in Epic 22).
 * Children render inert: visually present, not interactive.
 */
export function ModuleUpsell({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  children?: ReactNode;
}) {
  const t = useTranslations('shell.moduleLocked');
  return (
    <div data-testid={`module-upsell-${moduleKey}`}>
      <div className="mb-8 flex items-start gap-4 rounded-2xl border border-gold/40 bg-gold-soft/40 p-6">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-ink">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t('title')}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t('hint')}</p>
        </div>
      </div>
      {children ? (
        <div aria-hidden className="pointer-events-none select-none opacity-70">
          {children}
        </div>
      ) : null}
    </div>
  );
}
