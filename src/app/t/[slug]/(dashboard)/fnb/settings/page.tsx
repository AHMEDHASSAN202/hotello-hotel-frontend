'use client';

import { ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { EmptyState } from '@/components/ui';

/**
 * Epic 21 (Task 2/16) AC2 — payment methods moved from here to the
 * hotel-level settings surface (`/settings/payment-methods`; backend:
 * `GET/PATCH tenant/settings/payment-methods`). This F&B spot stays as a
 * guidance pointer rather than a hard redirect: staff who land here out of
 * habit see where the setting lives now and choose to follow the link,
 * instead of being silently bounced.
 */
export default function FnbSettingsPage() {
  const t = useTranslations('fnb.settings');
  const tFnb = useTranslations('fnb');
  const { hasPermission } = useTenant();
  const canManage = hasPermission('fnb_settings.manage');
  const { slug } = useParams<{ slug: string }>();

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={tFnb('board.noAccess.title')}
        hint={tFnb('board.noAccess.hint')}
      />
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gold">
        {tFnb('eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{t('body')}</PageIntro>

      <section className="mt-6 max-w-md rounded-xl border border-line bg-white p-6">
        <p className="text-sm text-ink-soft">{t('hint')}</p>
        <Link
          href={`/t/${slug}/settings/payment-methods`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-deep"
        >
          {t('cta')}
          <ArrowRight size={15} aria-hidden className="rtl:-scale-x-100" />
        </Link>
      </section>
    </div>
  );
}
