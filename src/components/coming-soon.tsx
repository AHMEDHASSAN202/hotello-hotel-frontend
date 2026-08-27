'use client';

import {
  BarChart3,
  Car,
  type LucideIcon,
  Paintbrush,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageIntro } from '@/components/guidance';
import type { ModuleKey } from '@/lib/types';

/**
 * The designed placeholder page behind an unbuilt module's route (the nav
 * shows the same module as a non-clickable "Soon" entry — see
 * `lib/modules.ts`). The intro sells what the module WILL do; the panel says
 * it arrives on its own — no setup, no broken promise, never a 404.
 */

const MODULE_ART: Partial<
  Record<ModuleKey, { icon: LucideIcon; labelKey: string }>
> = {
  transportation: { icon: Car, labelKey: 'transportation' },
  housekeeping: { icon: Sparkles, labelKey: 'housekeeping' },
  guest_app_branding: { icon: Paintbrush, labelKey: 'branding' },
  analytics: { icon: BarChart3, labelKey: 'analytics' },
};

export function ComingSoon({ moduleKey }: { moduleKey: ModuleKey }) {
  const t = useTranslations('shell');
  const params = useParams<{ slug: string }>();
  const { icon: Icon, labelKey } = MODULE_ART[moduleKey] ?? {
    icon: Sparkles,
    labelKey: moduleKey,
  };
  const label = t(`nav.${labelKey}`);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-gold">
        {t('comingSoon.eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {label}
      </h1>
      <PageIntro>{t(`comingSoon.blurb.${moduleKey}`)}</PageIntro>

      <div className="mt-8 rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <Icon size={22} className="text-gold" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-medium text-ink">
          {t('comingSoon.title', { module: label })}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
          {t('comingSoon.hint')}
        </p>
        <Link
          href={`/t/${params.slug}`}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          {t('comingSoon.back')}
        </Link>
      </div>
    </div>
  );
}
