'use client';

import { MapPin, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge, Bdi } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import type { FnbOrderStatus, FnbPaymentMethod, TenantFnbOrder } from '@/lib/types';
import { OPEN_FNB_ORDER_STATUSES } from '@/lib/types';
import { slaState } from '../board/board-core';

/**
 * One kitchen ticket (16.7 AC1): lines (qty × item, variant, note with
 * language tag), destination PROMINENT, payment chip, guest + room, live
 * age vs the prep SLA. Click opens the lifecycle drawer.
 */
const STATUS_TONE: Record<
  FnbOrderStatus,
  'gold' | 'warning' | 'success' | 'neutral'
> = {
  new: 'gold',
  preparing: 'warning',
  on_the_way: 'warning',
  delivered: 'success',
  cancelled: 'neutral',
};

export function destinationLabel(
  order: TenantFnbOrder,
  locale: string,
  t: ReturnType<typeof useTranslations<'fnb'>>,
): string {
  if (order.destinationType === 'room') {
    return t('card.room', { room: order.roomNumber });
  }
  const location =
    (locale === 'ar' ? order.locationNameAr : order.locationNameEn) ??
    order.locationNameEn ??
    '';
  if (!order.spot) return location;
  return `${location} · ${order.spot}`;
}

export type PaymentTone = 'success' | 'warning' | 'neutral' | 'gold';

/**
 * The shared payment-badge tone rule: included beats everything (success),
 * room-charge is a warning unless it's already settled (neutral — nothing
 * left to collect), cash is always gold. Shared by the F&B ticket chip
 * (`PaymentChip`, full amount + settlement) and the events attendees badge
 * (`AttendeePaymentBadge`, Story 21.6 — method only, no per-row amount or
 * settlement in that endpoint's response, so `settled` is always omitted
 * there) so the two badges can't drift on what each tone means.
 */
export function paymentTone(
  paymentMethod: FnbPaymentMethod | null,
  included: boolean,
  settled = false,
): PaymentTone {
  if (included) return 'success';
  if (paymentMethod === 'room_charge') return settled ? 'neutral' : 'warning';
  return 'gold';
}

export function PaymentChip({ order }: { order: TenantFnbOrder }) {
  const t = useTranslations('fnb');
  const { locale, formatCurrency } = useFormatters();
  if (order.totalAmount === 0) {
    return (
      <Badge tone={paymentTone(order.paymentMethod, true)}>
        {t('payment.included')}
      </Badge>
    );
  }
  const amount = formatCurrency(order.totalAmount, order.currency);
  if (order.paymentMethod === 'room_charge') {
    return (
      <Badge tone={paymentTone('room_charge', false, Boolean(order.settledAt))}>
        {t('payment.roomChargeAmount', { amount })}
        {order.settledAt ? ` · ${t('payment.settled')}` : ''}
      </Badge>
    );
  }
  return (
    <Badge tone={paymentTone('cash', false)}>
      {t('payment.cash', { amount })}
    </Badge>
  );
}

export function OrderCard({
  order,
  now,
  onOpen,
}: {
  order: TenantFnbOrder;
  now: Date;
  onOpen: (order: TenantFnbOrder) => void;
}) {
  const t = useTranslations('fnb');
  const { locale, formatRelativeTime } = useFormatters();
  const sla = slaState(order, now, OPEN_FNB_ORDER_STATUSES);
  const elapsedMinutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(order.createdAt).getTime()) / 60_000),
  );
  const lineName = (line: TenantFnbOrder['lines'][number]) =>
    locale === 'ar' ? line.itemNameAr : line.itemNameEn;
  const optionName = (line: TenantFnbOrder['lines'][number]) =>
    locale === 'ar' ? line.variantOptionNameAr : line.variantOptionNameEn;

  return (
    <button
      data-testid={`fnb-order-card-${order.id}`}
      onClick={() => onOpen(order)}
      className="w-full animate-banner-in rounded-xl border border-line bg-white p-4 text-start shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Destination is the headline — the runner reads it from a distance. */}
        <span className="flex min-w-0 items-center gap-2 font-display text-base font-semibold text-ink">
          <MapPin size={16} className="shrink-0 text-gold" aria-hidden />
          <span className="truncate">{destinationLabel(order, locale, t)}</span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <PaymentChip order={order} />
          <Badge tone={STATUS_TONE[order.status]}>
            {t(`board.status.${order.status}`)}
          </Badge>
          {sla === 'overdue' ? (
            <Badge tone="danger">{t('sla.overdue')}</Badge>
          ) : (
            <span className="text-xs tabular-nums text-ink-soft">
              {t('sla.progress', {
                elapsed: elapsedMinutes,
                target: order.slaTargetMinutes,
              })}
            </span>
          )}
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {order.lines.slice(0, 4).map((line) => (
          <li key={line.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium tabular-nums text-ink">
              {line.quantity}×
            </span>
            <span className="text-ink">{lineName(line)}</span>
            {line.variantOptionNameEn ? (
              <span className="text-ink-soft">· {optionName(line)}</span>
            ) : null}
            {line.included ? (
              <span className="text-xs font-medium text-success">
                {t('payment.included')}
              </span>
            ) : null}
            {line.note ? (
              <span className="flex items-center gap-1 text-ink-soft">
                <span className="truncate italic">“{line.note}”</span>
                <span className="shrink-0 rounded bg-line/60 px-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  {order.guestLanguage}
                </span>
              </span>
            ) : null}
          </li>
        ))}
        {order.lines.length > 4 ? (
          <li className="text-xs text-ink-soft">
            {t('card.linesMore', { count: order.lines.length - 4 })}
          </li>
        ) : null}
      </ul>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
        <span>{order.guestName}</span>
        <span>
          · {t('card.roomWord')} <Bdi>{order.roomNumber}</Bdi>
        </span>
        <span className="text-ink-soft/70">
          · {formatRelativeTime(order.createdAt, now)}
        </span>
        {order.assignedTo ? (
          <span className="ms-auto flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft">
            <UserRound size={12} aria-hidden />
            {order.assignedTo.name}
          </span>
        ) : null}
      </p>
    </button>
  );
}
