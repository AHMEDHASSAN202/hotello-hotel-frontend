import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';

/**
 * Epic 12, Story 12.3 AC3 — "no results" and "empty" are never the same
 * screen: filtered-to-zero offers a clear-filters action; a truly empty list
 * shows the designed empty state with its add-staff CTA.
 */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' } },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => true), // hide the first-run HintCard here
  dismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({
  useTenant: () => tenant,
}));

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly details?: unknown,
      public readonly code?: string,
    ) {
      super(message);
    }
  },
}));

import StaffPage from '../../app/t/[slug]/(dashboard)/staff/page';

function renderPage() {
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.startsWith('/tenant/roles/options')) return [];
    return { data: [], total: 0, page: 1, pageSize: 20 };
  });
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <StaffPage />
    </NextIntlClientProvider>,
  );
}

describe('staff list empty vs no-results (12.3 AC3)', () => {
  it('a truly empty list shows the designed empty state with the add CTA', async () => {
    renderPage();
    expect(await screen.findByText('No staff yet')).toBeTruthy();
    // Header button + the empty state's own CTA.
    expect(
      screen.getAllByRole('button', { name: 'Add staff' }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('No staff match your filters')).toBeNull();
  });

  it('filtered-to-zero shows the no-results screen with a clear action that restores the empty state', async () => {
    renderPage();
    await screen.findByText('No staff yet');

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'active' },
    });

    expect(
      await screen.findByText('No staff match your filters'),
    ).toBeTruthy();
    expect(screen.queryByText('No staff yet')).toBeNull();

    // Both the always-visible filter summary (12.3 AC2) and the no-results
    // screen (12.3 AC3) expose the clear action.
    const clearButtons = screen.getAllByRole('button', {
      name: 'Clear filters',
    });
    expect(clearButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(clearButtons[0]);
    expect(await screen.findByText('No staff yet')).toBeTruthy();
  });
});
