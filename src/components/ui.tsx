'use client';

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  Inbox,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  useEffect,
} from 'react';

/* ------------------------------------------------------- Bidi isolation */

/**
 * Isolates LTR content (emails, slugs, URLs, permission keys) inside an RTL
 * context so surrounding Arabic punctuation never visually reorders. Renders a
 * native <bdi>.
 */
export function Bdi({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <bdi className={className}>{children}</bdi>;
}

/**
 * Code-like inline value (permission keys, slugs, IDs). Always LTR + monospace
 * + bidi-isolated — these render identically in both languages.
 */
export function Code({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code
      dir="ltr"
      className={`inline-block font-mono [unicode-bidi:isolate] ${className}`}
    >
      {children}
    </code>
  );
}

/* ----------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-deep disabled:bg-ink/50',
  ghost:
    'bg-transparent text-ink border border-line hover:border-ink disabled:opacity-50',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50',
};

export function Button({
  variant = 'primary',
  loading = false,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${buttonStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Field */

export function Field({
  label,
  hint,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 disabled:bg-paper disabled:text-ink-soft"
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ Badge */

type BadgeTone = 'neutral' | 'gold' | 'success' | 'danger' | 'warning';

const badgeStyles: Record<BadgeTone, string> = {
  neutral: 'bg-paper text-ink-soft border border-line',
  gold: 'bg-gold-soft text-ink border border-gold/40',
  success: 'bg-success/10 text-success border border-success/30',
  danger: 'bg-danger/10 text-danger border border-danger/30',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyles[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Skeleton */

/** Animated placeholder — reserves layout so content swap-in causes no shift. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded-md bg-line/60 ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </span>
  );
}

/* ------------------------------------------------------------------ Banner */

type BannerVariant = 'info' | 'trial' | 'warning' | 'danger';

const bannerStyles: Record<BannerVariant, string> = {
  info: 'border-line bg-white text-ink',
  trial: 'border-gold/40 bg-gold-soft text-ink',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-danger/30 bg-danger/5 text-danger',
};

const bannerIcons: Record<BannerVariant, typeof Info> = {
  info: Info,
  trial: Sparkles,
  warning: AlertTriangle,
  danger: AlertTriangle,
};

/** Attention surface for subscription state (trial countdown, read-only, etc.). */
export function Banner({
  variant = 'info',
  title,
  children,
  action,
  icon,
}: {
  variant?: BannerVariant;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const Icon = bannerIcons[variant];
  return (
    <div
      role="status"
      className={`flex animate-banner-in items-start gap-3 rounded-xl border px-4 py-3 text-sm ${bannerStyles[variant]}`}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon ?? <Icon size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-current/90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations('common');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('actions.close')}
            className="rounded p-1 text-ink-soft hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Pagination */

export const selectClass =
  'rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink';

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations('common');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
      <p>
        {t('pagination.summary', { from, to, total })} ·{' '}
        {t('pagination.pageOf', { page, pages: totalPages })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={15} aria-hidden className="rtl:-scale-x-100" />{' '}
          {t('pagination.previous')}
        </Button>
        <Button
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('pagination.next')}{' '}
          <ChevronRight size={15} aria-hidden className="rtl:-scale-x-100" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Empty & Error */

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white py-12 text-center">
      <span className="text-ink-soft/50" aria-hidden>
        {icon ?? <Inbox size={28} />}
      </span>
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="max-w-md text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const t = useTranslations('common');
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 py-10 text-center">
      <AlertTriangle size={28} className="text-danger" aria-hidden />
      <p className="font-medium text-ink">{t('states.errorTitle')}</p>
      <p className="text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry} className="mt-2">
          {t('actions.retry')}
        </Button>
      )}
    </div>
  );
}
