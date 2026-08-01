'use client';

import { CheckCircle2, Circle, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTenant } from '@/components/tenant-provider';

/**
 * Epic 12, Story 12.4 AC3 — the getting-started block on the dashboard home.
 * Completion is derived server-side from existing data (`me.setup`) — no
 * tracking tables — and each step links to its page. The block disappears
 * once every step is complete, or when the user dismisses it (persisted via
 * the `home.setupSteps` hint key). Rooms/QR steps join with Epic 11.
 */
export function SetupSteps() {
  const t = useTranslations('guidance.home');
  const tGc = useTranslations('guidance.common');
  const params = useParams<{ slug: string }>();
  const { me, hasPermission, isHintDismissed, dismissHint } = useTenant();

  const setup = me?.setup;
  if (!setup || setup.complete || isHintDismissed('home.setupSteps')) {
    return null;
  }

  // Only steps the user can actually perform (12.4 AC1 — CTAs are
  // permission-gated); others would be dead ends on this screen.
  const steps = [
    {
      key: 'addStaff',
      done: setup.staffAdded,
      href: `/t/${params.slug}/staff`,
      allowed: hasPermission('staff.invite'),
      title: t('stepAddStaff'),
      hint: t('stepAddStaffHint'),
    },
    {
      key: 'createRole',
      done: setup.roleCreated,
      href: `/t/${params.slug}/roles`,
      allowed: hasPermission('roles.create'),
      title: t('stepCreateRole'),
      hint: t('stepCreateRoleHint'),
    },
  ].filter((s) => s.allowed);

  if (steps.length === 0) return null;

  return (
    <section
      aria-label={t('setupTitle')}
      className="rounded-xl border border-gold/40 bg-white p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-ink">
            {t('setupTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t('setupSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => dismissHint('home.setupSteps')}
          aria-label={tGc('dismiss')}
          className="shrink-0 rounded p-1 text-ink-soft transition-colors hover:text-ink"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-3">
            {step.done ? (
              <CheckCircle2
                size={20}
                className="mt-0.5 shrink-0 text-success"
                aria-hidden
              />
            ) : (
              <Circle
                size={20}
                className="mt-0.5 shrink-0 text-line"
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  step.done ? 'text-ink-soft' : 'text-ink'
                }`}
              >
                {step.title}
              </p>
              {!step.done && (
                <p className="text-xs text-ink-soft">{step.hint}</p>
              )}
            </div>
            {step.done ? (
              <span className="shrink-0 text-xs font-medium text-success">
                {t('stepDone')}
              </span>
            ) : (
              <Link
                href={step.href}
                className="shrink-0 text-sm font-medium text-ink underline-offset-2 hover:underline"
              >
                {t('openPage')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
