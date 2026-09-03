import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import { DEMO_ANALYTICS } from '@/lib/demo-analytics';
import { OverviewContent } from './overview-content';

/** Task F2a, Part 2 — Story 22.1 (all sections) + 22.6 AC2 (revenue visibility). */
function renderContent(canReadRevenue: boolean, report = DEMO_ANALYTICS) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <OverviewContent report={report} canReadRevenue={canReadRevenue} slug="sunrise" />
    </NextIntlClientProvider>,
  );
}

describe('OverviewContent (Story 22.1)', () => {
  it('renders all sections with DEMO_ANALYTICS', () => {
    renderContent(true);
    expect(screen.getByText(en.analytics.overview.occupancy.heading)).toBeTruthy();
    expect(screen.getByText(en.analytics.overview.service.heading)).toBeTruthy();
    expect(screen.getByText(en.analytics.overview.housekeeping.heading)).toBeTruthy();
    expect(screen.getByText(en.analytics.overview.revenue.heading)).toBeTruthy();
    // Occupancy figures
    expect(screen.getByText('38/50')).toBeTruthy();
    expect(screen.getByText('76%')).toBeTruthy();
    // Service figures
    expect(screen.getByText('142')).toBeTruthy();
    expect(screen.getByText('131')).toBeTruthy();
    // Housekeeping figures
    expect(screen.getByText('21')).toBeTruthy();
    // Top requested item name shows up
    expect(screen.getByText('Extra towels')).toBeTruthy();
  });

  it('canReadRevenue: false → the revenue section is absent from the DOM entirely, even though report.revenue is present', () => {
    renderContent(false);
    expect(screen.queryByText(en.analytics.overview.revenue.heading)).toBeNull();
    expect(DEMO_ANALYTICS.revenue).toBeDefined();
  });

  it('canReadRevenue: true with report.revenue present → revenue section renders with correctly formatted currency', () => {
    renderContent(true);
    expect(screen.getByText('EGP 18,420.00')).toBeTruthy();
    expect(screen.getByText('EGP 4,200.00')).toBeTruthy();
    expect(screen.getByText('EGP 22,620.00')).toBeTruthy();
    expect(screen.getByText('EGP 9,840.00')).toBeTruthy();
    expect(screen.getByText('EGP 12,780.00')).toBeTruthy();
    expect(screen.getByText('EGP 3,120.00')).toBeTruthy();
  });

  it('Task F2d — the unsettled-total stat tile links to the stays list filtered by hasBalance', () => {
    renderContent(true);
    const link = screen.getByText('EGP 3,120.00').closest('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/t/sunrise/stays?hasBalance=true');
  });

  it('delta chips say "vs same time yesterday" when the period preset is today, "vs previous period" otherwise', () => {
    renderContent(true, {
      ...DEMO_ANALYTICS,
      period: { ...DEMO_ANALYTICS.period, preset: 'today' as const },
    });
    expect(screen.getAllByText(en.reports.delta.vsYesterday).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.reports.delta.vsPrevious)).toBeNull();
  });

  it('a MetricWithDelta with no deltaPct renders the stat tile without a delta chip next to it', () => {
    const noDeltaReport = {
      ...DEMO_ANALYTICS,
      service: {
        ...DEMO_ANALYTICS.service,
        received: { value: 142 },
      },
    };
    renderContent(true, noDeltaReport);
    // The value still renders...
    expect(screen.getByText('142')).toBeTruthy();
    // ...but the original deltaPct's rendered text (12.5%) is gone — nothing
    // extra appears in the DOM for this tile once deltaPct is absent.
    expect(screen.queryByText('12.5%')).toBeNull();
  });
});
