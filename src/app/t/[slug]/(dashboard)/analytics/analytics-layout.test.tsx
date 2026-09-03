import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en';
import { DEMO_ANALYTICS } from '@/lib/demo-analytics';

/**
 * Task F2a, Part 3 — Story 22.6 AC1/AC2: a locked hotel visiting ANY analytics
 * sub-route sees the same Overview sample (the layout intercepts before any
 * child route renders), with the subnav hidden and zero network calls.
 */

const tenant = vi.hoisted(() => ({
  isModuleEnabled: vi.fn(() => false),
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
  usePathname: () => '/t/sunrise/analytics',
}));

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: apiMock.api }));

import AnalyticsLayout from './layout';

function renderLayout(children: React.ReactNode = <div data-testid="child" />) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnalyticsLayout>{children}</AnalyticsLayout>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.isModuleEnabled.mockReturnValue(false);
  tenant.hasPermission.mockReturnValue(true);
});

describe('Analytics layout — locked composition (Story 22.6 AC1)', () => {
  it('locked: renders ModuleUpsell with the sample-data label and the demo Overview, subnav absent, no api calls', () => {
    renderLayout();
    expect(screen.getByTestId('module-upsell-analytics')).toBeTruthy();
    const label = screen.getByTestId('sample-data-label');
    expect(label.textContent).toBe(en.reports.sampleDataLabel);
    // Demo figures from DEMO_ANALYTICS are visible.
    expect(
      screen.getByText(
        `${DEMO_ANALYTICS.occupancy.occupiedNow}/${DEMO_ANALYTICS.occupancy.totalRooms}`,
      ),
    ).toBeTruthy();
    expect(screen.getByText(en.analytics.overview.revenue.heading)).toBeTruthy();
    // Subnav is gone — nowhere to navigate to while locked.
    expect(screen.queryByLabelText(en.analytics.tabsLabel)).toBeNull();
    // The real child route never renders while locked.
    expect(screen.queryByTestId('child')).toBeNull();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('locked + a user without reports.revenue → the revenue section is absent from the sample too (22.6 AC2)', () => {
    tenant.hasPermission.mockImplementation((key: string) => key !== 'reports.revenue');
    renderLayout();
    expect(screen.queryByText(en.analytics.overview.revenue.heading)).toBeNull();
  });

  it('unlocked: subnav renders and children render, not the demo composition', () => {
    tenant.isModuleEnabled.mockReturnValue(true);
    renderLayout();
    expect(screen.getByLabelText(en.analytics.tabsLabel)).toBeTruthy();
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.queryByTestId('module-upsell-analytics')).toBeNull();
    expect(screen.queryByTestId('sample-data-label')).toBeNull();
    expect(apiMock.api).not.toHaveBeenCalled();
  });
});
