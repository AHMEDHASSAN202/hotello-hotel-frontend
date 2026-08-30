'use client';

import { ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EventStatusBadge } from '@/components/events/status-badge';
import { paymentTone } from '@/components/fnb/order-card';
import { InfoTip, PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import { Badge, Bdi, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  EventAttendeesResponse,
  EventBookingStatus,
  FnbPaymentMethod,
  RequestTranslationMap,
} from '@/lib/types';

const BOOKING_STATUS_TONE: Record<EventBookingStatus, 'gold' | 'neutral'> = {
  booked: 'gold',
  cancelled: 'neutral',
};

/**
 * One attendee row's payment method badge. `GET tenant/events/:id/attendees`
 * (backend Task 8, `AttendeeBookingView`) resolves guest/room live but does
 * NOT carry a per-booking amount or settlement flag — those only exist in
 * the aggregate `totals` below (deliberately: `expectedRoomCharge` excludes
 * bookings already `settledAt`, a fact only knowable in aggregate here).
 * So this shows the payment method only, no amount — but shares the F&B
 * `PaymentChip`'s exact tone rule (`paymentTone`, `fnb/order-card.tsx`)
 * rather than literally reusing the chip itself, since `PaymentChip`
 * requires `order.totalAmount`/`order.settledAt`, which this endpoint's
 * response shape doesn't provide per row (`settled` is always omitted here).
 */
function AttendeePaymentBadge({ method }: { method: FnbPaymentMethod | null }) {
  const t = useTranslations('events');
  const included = method === null;
  const tone = paymentTone(method, included);
  if (included) {
    return <Badge tone={tone}>{t('attendees.payment.included')}</Badge>;
  }
  if (method === 'room_charge') {
    return <Badge tone={tone}>{t('attendees.payment.roomCharge')}</Badge>;
  }
  return <Badge tone={tone}>{t('attendees.payment.cash')}</Badge>;
}

/**
 * Epic 21, Story 21.6 AC1 — read-only attendee list + live totals for one
 * event. A route (not a modal): this is a full table view with its own
 * header stats, the same shape as the F&B history tab it mirrors, and this
 * app has no precedent for a modal at "drill into one record's full list"
 * depth — the existing detail modals (F&B `OrderDetailModal`, announcements'
 * `AnnouncementDetailModal`) show a single record's own fields, not a table
 * of many child rows. `EventAttendeesResponse.bookings` is a plain array —
 * Task 8's response isn't paginated — so the whole list renders client-side,
 * no `Pagination` (exportless MVP, per the plan).
 */
export default function EventAttendeesPage() {
  const t = useTranslations('events');
  const g = useTranslations('guidance.events');
  const locale = useLocale();
  const resolveError = useApiError();
  const { hasPermission, me } = useTenant();
  const { formatCurrency, formatDateTime } = useFormatters();
  const params = useParams<{ slug: string; id: string }>();

  const canRead = hasPermission('events.read');
  const currency = me?.hotel.currency ?? 'EGP';
  const base = `/t/${params.slug}/events`;

  const [data, setData] = useState<EventAttendeesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(
        await api<EventAttendeesResponse>(
          `/tenant/events/${params.id}/attendees`,
        ),
      );
    } catch (err) {
      setLoadError(resolveError(err));
    }
  }, [params.id, resolveError]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  if (!canRead) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  const titleFor = (titles: RequestTranslationMap) =>
    (locale === 'ar' ? titles.ar : titles.en) ?? titles.en ?? '';

  return (
    <div>
      <Link
        href={base}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
      >
        <ArrowLeft size={16} className="rtl:-scale-x-100" aria-hidden />
        {t('attendees.back')}
      </Link>

      {loadError ? (
        <div className="mt-6">
          <ErrorState message={loadError} onRetry={() => void load()} />
        </div>
      ) : data === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-20 w-full max-w-2xl" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-2">
            <p className="text-xs font-medium uppercase tracking-widest text-gold">
              {t('attendees.eyebrow')}
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-2xl font-semibold text-ink">
              {titleFor(data.event.titles)}
              <EventStatusBadge status={data.event.status} />
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {t('list.start', { time: data.event.startAtLocal })}
              {' · '}
              {data.event.locationText}
            </p>
            <PageIntro>{g('attendees.intro')}</PageIntro>
          </div>

          {/* Live totals — booked/capacity + the two settlement-aware "expected" figures. */}
          <div className="mt-5 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="flex items-center gap-1 text-xs text-ink-soft">
                {t('attendees.totals.bookedLabel')}
                <InfoTip label={t('attendees.totals.bookedLabel')}>
                  {g('attendees.totals.booked')}
                </InfoTip>
              </p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                {data.totals.capacity === null
                  ? t('list.capacity.unlimited', { booked: data.totals.booked })
                  : t('list.capacity.bounded', {
                      booked: data.totals.booked,
                      capacity: data.totals.capacity,
                    })}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="flex items-center gap-1 text-xs text-ink-soft">
                {t('attendees.totals.cashLabel')}
                <InfoTip label={t('attendees.totals.cashLabel')}>
                  {g('attendees.totals.cash')}
                </InfoTip>
              </p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                {formatCurrency(data.totals.expectedCash, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="flex items-center gap-1 text-xs text-ink-soft">
                {t('attendees.totals.roomChargeLabel')}
                <InfoTip label={t('attendees.totals.roomChargeLabel')}>
                  {g('attendees.totals.roomCharge')}
                </InfoTip>
              </p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                {formatCurrency(data.totals.expectedRoomCharge, currency)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            {data.bookings.length === 0 ? (
              <EmptyState
                title={t('attendees.empty.title')}
                hint={t('attendees.empty.hint')}
              />
            ) : (
              <div
                data-testid="attendees-table"
                className="overflow-x-auto rounded-xl border border-line bg-white"
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wider text-ink-soft">
                      <th className="px-4 py-3 text-start">
                        {t('attendees.table.guest')}
                      </th>
                      <th className="px-4 py-3 text-start">
                        {t('attendees.table.partySize')}
                      </th>
                      <th className="px-4 py-3 text-start">
                        {t('attendees.table.payment')}
                      </th>
                      <th className="px-4 py-3 text-start">
                        {t('attendees.table.status')}
                      </th>
                      <th className="px-4 py-3 text-start">
                        {t('attendees.table.bookedAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookings.map((b, i) => (
                      <tr
                        key={`${b.guestName}-${b.roomNumber}-${b.bookedAt}-${i}`}
                        className="border-b border-line/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-ink">
                          {b.guestName} ·{' '}
                          <Bdi>{b.roomNumber}</Bdi>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {b.partySize}
                        </td>
                        <td className="px-4 py-3">
                          <AttendeePaymentBadge method={b.paymentMethod} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={BOOKING_STATUS_TONE[b.status]}>
                            {t(`attendees.bookingStatus.${b.status}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-ink-soft">
                          {formatDateTime(b.bookedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
