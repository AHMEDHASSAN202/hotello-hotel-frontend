import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import type { DiningReport } from '@/lib/types';
import { DiningContent } from './dining-content';
import { mockResponsiveContainerSize } from './charts/test-support';

mockResponsiveContainerSize();

const FIXTURE: DiningReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
  revenueByDay: [
    { date: '2026-08-27', revenue: 4200, orders: 18 },
    { date: '2026-08-28', revenue: 5100, orders: 22 },
  ],
  ordersCount: 40,
  revenueTotal: 9300,
  avgOrderValue: 232.5,
  topItems: [
    { itemId: 'item-1', names: { en: 'Grilled Chicken' }, qty: 15, revenue: 3000 },
    { itemId: 'item-2', names: { en: 'Caesar Salad' }, qty: 10, revenue: 1200 },
  ],
  includedConsumption: [
    { itemId: 'item-3', names: { en: 'Breakfast Mojito' }, qty: 8 },
  ],
  byZone: [
    { destinationType: 'room', locationKey: null, names: null, revenue: 6000, orders: 25 },
    { destinationType: 'location', locationKey: 'pool', names: { en: 'Pool Bar' }, revenue: 3300, orders: 15 },
  ],
  paymentSplit: { cash: 4000, roomCharge: 5300 },
  cancellations: { count: 3, reasons: [{ reason: 'duplicate', count: 2 }] },
  basis: 'delivered_only',
};

function renderContent(report: DiningReport = FIXTURE) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <DiningContent report={report} />
    </NextIntlClientProvider>,
  );
}

describe('DiningContent (Task F2c, Part 2)', () => {
  it('renders the ordersCount, revenueTotal, and avgOrderValue stat tiles with formatted currency', () => {
    renderContent();
    const stats = screen.getByTestId('dining-stats');
    expect(within(stats).getByText(en.analytics.dining.ordersCount)).toBeTruthy();
    expect(within(stats).getByText('40')).toBeTruthy();
    expect(within(stats).getByText(en.analytics.dining.revenueTotal)).toBeTruthy();
    expect(within(stats).getByText('EGP 9,300.00')).toBeTruthy();
    expect(within(stats).getByText(en.analytics.dining.avgOrderValue)).toBeTruthy();
    expect(within(stats).getByText('EGP 232.50')).toBeTruthy();
  });

  it('null avgOrderValue renders "—", never "null"/"NaN"', () => {
    renderContent({ ...FIXTURE, avgOrderValue: null });
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.queryByText('NaN')).toBeNull();
  });

  it('top items table renders Item | Qty | Revenue with formatted currency', () => {
    renderContent();
    const heading = screen.getByText(en.analytics.dining.topItems);
    const section = heading.closest('section')!;
    expect(within(section).getByText('Grilled Chicken')).toBeTruthy();
    expect(within(section).getByText('15')).toBeTruthy();
    expect(within(section).getByText('EGP 3,000.00')).toBeTruthy();
  });

  it(
    'included consumption table renders Item | Qty ONLY — no revenue-shaped cell or column anywhere in that ' +
      "section (Story 22.3 AC1: a ✓Included mojito is a cost, not a sale)",
    () => {
      renderContent();
      const heading = screen.getByText(en.analytics.dining.includedConsumption);
      const section = heading.closest('section')!;
      expect(within(section).getByText('Breakfast Mojito')).toBeTruthy();
      expect(within(section).getByText('8')).toBeTruthy();
      // Exactly 2 header columns — Item, Qty — no Revenue header at all.
      const headerCells = section.querySelectorAll('thead th');
      expect(headerCells.length).toBe(2);
      // The explanatory honesty caption is present…
      expect(screen.getByText(en.analytics.dining.includedConsumptionCaption)).toBeTruthy();
      // …and no currency-formatted value (as used for topItems' revenue) leaks into this section.
      expect(within(section).queryByText(/EGP/)).toBeNull();
    },
  );

  it("the includedConsumption heading reads distinctly from \"Top sellers\" so nobody conflates the two tables", () => {
    renderContent();
    expect(en.analytics.dining.includedConsumption).not.toBe(en.analytics.dining.topItems);
    expect(screen.getByText(en.analytics.dining.topItems)).toBeTruthy();
    expect(screen.getByText(en.analytics.dining.includedConsumption)).toBeTruthy();
  });

  it('byZone table renders "Room" for destinationType==="room" and the English-preferred zone name otherwise', () => {
    renderContent();
    expect(screen.getByText(en.analytics.dining.zoneRoom)).toBeTruthy();
    expect(screen.getByText('Pool Bar')).toBeTruthy();
    expect(screen.getByText('EGP 6,000.00')).toBeTruthy();
    expect(screen.getByText('EGP 3,300.00')).toBeTruthy();
  });

  it('cancellations renders the count stat tile and translated reason labels', () => {
    renderContent();
    expect(screen.getByText(en.analytics.dining.cancellations)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(en.requests.cancelReason.duplicate)).toBeTruthy();
  });

  it('renders the delivered_only BasisFootnote', () => {
    renderContent();
    expect(screen.getByText(en.reports.basis.delivered_only)).toBeTruthy();
  });
});
