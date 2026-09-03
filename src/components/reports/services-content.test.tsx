import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import type { RequestsReport } from '@/lib/types';
import { requestsReportLink } from '@/lib/report-links';
import { ServicesContent } from './services-content';
import { mockResponsiveContainerSize } from './charts/test-support';

mockResponsiveContainerSize();

const FIXTURE: RequestsReport = {
  period: { preset: 'last7', from: '2026-08-27', to: '2026-09-02', days: 7 },
  receivedCount: 142,
  completedCount: 131,
  overallDoneWithSlaCount: 120,
  overallSlaBreachRatePct: 4.2,
  overallAvgCompletionMinutes: 24.5,
  volumeByDay: [
    { date: '2026-08-27', count: 20 },
    { date: '2026-08-28', count: 25 },
  ],
  byCategory: [
    { categoryId: 'cat-1', names: { en: 'Housekeeping' }, count: 40, slaCompliancePct: 96, avgCompletionMinutes: 18 },
    { categoryId: 'cat-2', names: { en: 'Maintenance' }, count: 12, slaCompliancePct: null, avgCompletionMinutes: null },
  ],
  byItem: [{ itemId: 'item-1', names: { en: 'Extra towels' }, count: 28 }],
  completionBuckets: [
    { label: '<15m', count: 44 },
    { label: '15-30m', count: 22 },
  ],
  cancellations: { count: 5, reasons: [{ reason: 'duplicate', count: 3 }] },
  busiestHours: Array.from({ length: 24 }, (_, h) => (h === 12 ? 10 : 1)),
};

function renderContent(report: RequestsReport = FIXTURE) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <ServicesContent report={report} slug="sunrise" />
    </NextIntlClientProvider>,
  );
}

describe('ServicesContent (Task F2b, Part 3)', () => {
  it('renders stat tiles with the fetched values', () => {
    renderContent();
    expect(screen.getByText(en.analytics.services.received)).toBeTruthy();
    expect(screen.getByText('142')).toBeTruthy();
    expect(screen.getByText(en.analytics.services.completed)).toBeTruthy();
    expect(screen.getByText('131')).toBeTruthy();
  });

  it('null overallSlaBreachRatePct/overallAvgCompletionMinutes render "—" not "null"/"NaN"', () => {
    renderContent({
      ...FIXTURE,
      overallSlaBreachRatePct: null,
      overallAvgCompletionMinutes: null,
    });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.queryByText('NaN')).toBeNull();
  });

  it('byCategory rows render Category | Count | SLA compliance % | Avg completion (min), with null cells as "—"', () => {
    renderContent();
    expect(screen.getByText('Housekeeping')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText('96%')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('Maintenance')).toBeTruthy();
  });

  it("a category row's link href matches requestsReportLink(slug, {categoryId, from: report.period.from, to: report.period.to}) exactly", () => {
    renderContent();
    const link = screen.getByText('Housekeeping').closest('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe(
      requestsReportLink('sunrise', {
        categoryId: 'cat-1',
        from: FIXTURE.period.from,
        to: FIXTURE.period.to,
      }),
    );
  });

  it('byItem renders item names and counts', () => {
    renderContent();
    expect(screen.getByText('Extra towels')).toBeTruthy();
    expect(screen.getByText('28')).toBeTruthy();
  });

  it('completionBuckets renders each bucket label and count', () => {
    renderContent();
    expect(screen.getByText('<15m')).toBeTruthy();
    expect(screen.getByText('15-30m')).toBeTruthy();
  });

  it('cancellations renders the count stat tile and reasons breakdown with translated reason labels', () => {
    renderContent();
    expect(screen.getByText(en.analytics.services.cancellations)).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText(en.requests.cancelReason.duplicate)).toBeTruthy();
  });

  it('Task F5 — the busiest-hours strip has a real section heading and a translated (non-hardcoded) aria-label', () => {
    renderContent();
    expect(screen.getByText(en.analytics.services.busiestHours)).toBeTruthy();
    expect(
      screen.getByRole('img', { name: en.analytics.services.busiestHours }),
    ).toBeTruthy();
  });

  it('Task F5 — the peak hour is visible as text near the heading, not locked behind hover-only tooltips', () => {
    renderContent();
    // The range is wrapped in <bdi> (via the message's <r> tag), so the
    // callout's text spans two nodes — assert on the container's textContent.
    const range = screen.getByText('12:00–13:00');
    const expected = en.analytics.services.busiestHoursPeak
      .replace('<r>{range}</r>', '12:00–13:00');
    expect(range.closest('span')?.textContent).toBe(expected);
  });

  it('the peak-hour range is bidi-isolated so it cannot visually reverse under RTL', () => {
    renderContent();
    // Without <bdi>, the direction-neutral en dash makes "12:00–13:00"
    // render as "13:00–12:00" inside an Arabic (RTL) paragraph.
    expect(screen.getByText('12:00–13:00').tagName).toBe('BDI');
  });

  it('Task F5 — no peak-hour callout renders when every bucket is zero', () => {
    renderContent({ ...FIXTURE, busiestHours: Array(24).fill(0) });
    expect(screen.queryByText(/Busiest:/)).toBeNull();
  });
});
