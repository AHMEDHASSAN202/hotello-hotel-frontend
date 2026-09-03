import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import type { TotalsReport } from '@/lib/types';
import { TotalsContent } from './totals-content';
import { mockResponsiveContainerSize } from './charts/test-support';

mockResponsiveContainerSize();

const FIXTURE: TotalsReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  currency: 'EGP',
  byDay: [
    { date: '2026-08-27', dining: 4200, events: 2000, total: 6200 },
    { date: '2026-08-28', dining: 5100, events: 3000, total: 8100 },
  ],
  byMethod: { cash: 6000, roomCharge: 8300 },
  grandTotal: 14300,
  collected: 10000,
  outstanding: 4300,
  basis: 'delivered_booked',
};

function renderContent(report: TotalsReport = FIXTURE) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <TotalsContent report={report} />
    </NextIntlClientProvider>,
  );
}

describe('TotalsContent (Task F2c, Part 4)', () => {
  it('renders grandTotal, collected, and outstanding as formatted currency', () => {
    renderContent();
    expect(screen.getByText(en.analytics.totals.grandTotal)).toBeTruthy();
    expect(screen.getByText('EGP 14,300.00')).toBeTruthy();
    expect(screen.getByText(en.analytics.totals.collected)).toBeTruthy();
    expect(screen.getByText('EGP 10,000.00')).toBeTruthy();
    expect(screen.getByText(en.analytics.totals.outstanding)).toBeTruthy();
    expect(screen.getByText('EGP 4,300.00')).toBeTruthy();
  });

  it("grandTotal is rendered visually larger/more prominent than collected/outstanding (Story 22.3 AC3 — \"the number the owner screenshots\")", () => {
    renderContent();
    const grandTotalValue = screen.getByText('EGP 14,300.00');
    const collectedValue = screen.getByText('EGP 10,000.00');
    // A simple, robust proxy for "more prominent": a strictly larger text-size
    // utility class on the grand-total figure than on the collected figure.
    const grandTotalSizeClass = grandTotalValue.className.match(/text-(\w+)/)?.[1];
    const collectedSizeClass = collectedValue.className.match(/text-(\w+)/)?.[1];
    const scale = ['sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
    expect(scale.indexOf(grandTotalSizeClass!)).toBeGreaterThan(scale.indexOf(collectedSizeClass!));
  });

  // Task F6 — SplitDonut is now next/dynamic(ssr:false), so it mounts
  // asynchronously; findBy* waits for the lazy import to resolve.
  it('renders a cash/room-charge SplitDonut for byMethod', async () => {
    renderContent();
    expect(await screen.findByText(en.reports.paymentMethod.cash)).toBeTruthy();
    expect(screen.getByText(en.reports.paymentMethod.roomCharge)).toBeTruthy();
  });

  it('renders the delivered_booked BasisFootnote', () => {
    renderContent();
    expect(screen.getByText(en.reports.basis.delivered_booked)).toBeTruthy();
  });
});
