'use client';

import { Info, Lightbulb, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTenant } from '@/components/tenant-provider';
import { Button, Modal } from '@/components/ui';

/**
 * Epic 12 — the guidance component kit (Story 12.1). One rule keeps the kit
 * from becoming noise (spec note 6): placeholder = realistic example,
 * Field `hint` = the rule / why, InfoTip = deeper context. Never all three
 * repeating the same sentence.
 */

/* -------------------------------------------------------------- PageIntro */

/**
 * One or two plain sentences under a page title stating what the page is for
 * (12.1 AC1). Content only — the page keeps its own <h1>.
 */
export function PageIntro({ children }: { children: ReactNode }) {
  return <p className="mt-1 max-w-2xl text-sm text-ink-soft">{children}</p>;
}

/* ------------------------------------------------------------ RequiredNote */

/**
 * The once-per-form explanation of the required-field marker (12.2 AC2) —
 * Field renders the * itself whenever `required` is set.
 */
export function RequiredNote() {
  const t = useTranslations('guidance.common');
  return <p className="text-xs text-ink-soft">{t('requiredNote')}</p>;
}

/* ---------------------------------------------------------------- InfoTip */

/**
 * A small ⓘ trigger showing a short explanation. Touch-first (12.1 AC2 /
 * spec note 4): tap toggles, outside-tap and Escape close — desktop
 * hover/focus is the enhancement, never the only path to the content.
 */
export function InfoTip({
  label,
  children,
}: {
  /** Accessible name for the trigger; defaults to the generic "More info". */
  label?: string;
  children: ReactNode;
}) {
  const t = useTranslations('guidance.common');
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex align-middle"
      // Hover open/close only for a real mouse — touch taps go through onClick.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label ?? t('infoTip')}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-0.5 text-ink-soft transition-colors hover:text-ink"
      >
        <Info size={14} aria-hidden />
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute start-0 top-full z-40 mt-1.5 block w-64 rounded-lg border border-line bg-white p-3 text-xs font-normal leading-relaxed text-ink shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}

/* --------------------------------------------------------------- HintCard */

/**
 * Dismissible first-run callout (12.4 AC2). `hintKey` must be one of the
 * backend's TENANT_HINT_KEYS — dismissal is persisted per user server-side,
 * so the card stays gone across devices and browsers.
 */
export function HintCard({
  hintKey,
  title,
  children,
  action,
}: {
  hintKey: string;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { isHintDismissed, dismissHint } = useTenant();
  const t = useTranslations('guidance.common');
  if (isHintDismissed(hintKey)) return null;
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-ink"
    >
      <Lightbulb size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-current/90">{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      <button
        type="button"
        onClick={() => dismissHint(hintKey)}
        aria-label={t('dismiss')}
        className="shrink-0 rounded p-1 text-ink-soft transition-colors hover:text-ink"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

/* -------------------------------------------------------- ConsequenceNote */

/**
 * The standardized explanation block inside confirmation dialogs (12.5 AC1):
 * what happens now, and what is reversible and how. `tone="danger"` is
 * reserved for genuinely irreversible/blocking actions (12.5 AC3) — the
 * visual language itself teaches severity.
 */
export function ConsequenceNote({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'danger';
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
        tone === 'danger'
          ? 'border-danger/30 bg-danger/5 text-ink'
          : 'border-line bg-paper text-ink'
      }`}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- ConfirmModal */

/**
 * Shared confirmation dialog (12.5): title + ConsequenceNote content +
 * cancel/confirm. `destructive` drives the red button and is reserved for
 * irreversible/blocking actions (12.5 AC3) — reversible ones (disable,
 * deactivate) stay on the primary style.
 */
export function ConfirmModal({
  open,
  onClose,
  title,
  confirmLabel,
  onConfirm,
  destructive = false,
  loading = false,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
  /** Inline API error, already resolved to a translated message. */
  error?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {children}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
