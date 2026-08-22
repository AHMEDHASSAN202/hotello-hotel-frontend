import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';
import type { RequestBoardCounts, TenantRequestView } from '@/lib/types';

/**
 * Epic 15, Stories 15.4–15.6 — the requests board. Same harness as
 * stays-page.test.tsx: mocked tenant context + api + requests feed, real
 * English messages, no jest-dom matchers.
 */

const tenant = vi.hoisted(() => ({
  me: {
    user: { id: 'u1' },
    hotel: { defaultLanguage: 'ar', timezone: 'Africa/Cairo' },
  },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => true),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({
  useTenant: () => tenant,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
}));

const feed = vi.hoisted(() => ({
  requests: null as TenantRequestView[] | null,
  counts: null as RequestBoardCounts | null,
  error: null,
  refresh: vi.fn(),
  applyRow: vi.fn(),
  boost: vi.fn(() => () => {}),
  onNewRequests: vi.fn(() => () => {}),
}));

vi.mock('@/components/requests/requests-feed-provider', () => ({
  useRequestsFeed: () => feed,
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

import RequestsPage from '../../app/t/[slug]/(dashboard)/requests/page';

function makeRequest(
  overrides: Partial<TenantRequestView> = {},
): TenantRequestView {
  return {
    id: 'req-1',
    itemNameEn: 'Extra towels',
    itemNameAr: 'مناشف إضافية',
    icon: 'layers',
    categoryId: 'cat-1',
    roomNumber: '204',
    floor: 2,
    guestName: 'Ivan Petrov',
    optionType: 'quantity',
    optionValue: '2',
    note: 'Побыстрее, пожалуйста',
    noteLanguage: 'ru',
    status: 'new',
    slaTargetMinutes: 20,
    dueAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    assignedTo: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <RequestsPage />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

beforeEach(() => {
  apiMock.api.mockReset();
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.startsWith('/tenant/request-catalog')) return { categories: [] };
    if (path.startsWith('/tenant/requests/assignees')) return [];
    return { data: [], total: 0, page: 1, pageSize: 20 };
  });
  tenant.hasPermission.mockReturnValue(true);
  feed.requests = null;
  feed.counts = null;
});

describe('RequestsPage (15.4)', () => {
  it('permission gate: no requests.read → EmptyState and zero API calls', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(screen.getByText('No access to requests')).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('AC1 — a card shows item, room, guest, note with language tag, status and SLA', () => {
    feed.requests = [makeRequest()];
    feed.counts = { open: 1, doneToday: 3, overdueNow: 0 };
    renderPage();
    const card = screen.getByTestId('request-card-req-1');
    const text = card.textContent ?? '';
    expect(text).toContain('Extra towels ×2');
    expect(text).toContain('204');
    expect(text).toContain('Ivan Petrov');
    expect(text).toContain('Побыстрее, пожалуйста');
    expect(within(card).getByText('ru')).toBeTruthy();
    expect(within(card).getByText('New')).toBeTruthy();
    expect(text).toContain('/20 min');
  });

  it('15.6 AC1 — overdue requests float to the top with the red chip', () => {
    const overdue = makeRequest({
      id: 'req-late',
      createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      dueAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    });
    const fresh = makeRequest({ id: 'req-fresh' });
    feed.requests = [fresh, overdue];
    renderPage();
    const cards = screen.getAllByTestId(/request-card-/);
    expect(cards[0].getAttribute('data-testid')).toBe('request-card-req-late');
    expect(within(cards[0]).getByText('Overdue')).toBeTruthy();
  });

  it('15.6 AC3 — the stats-lite header renders the three counts', () => {
    feed.requests = [];
    feed.counts = { open: 4, doneToday: 7, overdueNow: 2 };
    renderPage();
    expect(screen.getByText('Open now')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('AC4 — the designed all-clear state when the board is empty', () => {
    feed.requests = [];
    renderPage();
    expect(screen.getByText('All clear')).toBeTruthy();
  });

  it('AC2 — the overdue-only filter narrows the board', () => {
    feed.requests = [
      makeRequest({ id: 'req-ok' }),
      makeRequest({
        id: 'req-late',
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    expect(screen.queryByTestId('request-card-req-ok')).toBeNull();
    expect(screen.getByTestId('request-card-req-late')).toBeTruthy();
  });

  it('AC3 — the sound toggle persists through the hint-key machinery', () => {
    tenant.isHintDismissed.mockReturnValue(false); // sound on
    feed.requests = [];
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: /sound is on/i }),
    );
    expect(tenant.dismissHint).toHaveBeenCalledWith('requests.soundMuted');
  });
});

describe('RequestDetailModal via board (15.5)', () => {
  it('opens the drawer with Start for a new request; cancel needs a reason', async () => {
    const row = makeRequest();
    feed.requests = [row];
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === `/tenant/requests/${row.id}`) {
        return {
          ...row,
          guestLanguage: 'ru',
          cancelNote: null,
          startedBy: null,
          completedBy: null,
          cancelledBy: null,
        };
      }
      if (path.startsWith('/tenant/request-catalog')) return { categories: [] };
      if (path.startsWith('/tenant/requests/assignees')) return [];
      return { data: [], total: 0, page: 1, pageSize: 20 };
    });
    renderPage();
    fireEvent.click(screen.getByTestId('request-card-req-1'));
    expect(await screen.findByRole('button', { name: /Start/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Cancel request/ }));
    expect(
      screen.getByText('Why is this request being cancelled?'),
    ).toBeTruthy();
    // 'other' without a note keeps confirm disabled
    fireEvent.click(screen.getByRole('radio', { name: 'Other' }));
    const confirm = screen.getByRole('button', {
      name: 'Cancel the request',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('hides Assign without requests.assign', async () => {
    const row = makeRequest();
    feed.requests = [row];
    tenant.hasPermission.mockImplementation(
      (key: string) => key !== 'requests.assign',
    );
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === `/tenant/requests/${row.id}`) {
        return {
          ...row,
          guestLanguage: 'ru',
          cancelNote: null,
          startedBy: null,
          completedBy: null,
          cancelledBy: null,
        };
      }
      if (path.startsWith('/tenant/request-catalog')) return { categories: [] };
      if (path.startsWith('/tenant/requests/assignees')) return [];
      return { data: [], total: 0, page: 1, pageSize: 20 };
    });
    renderPage();
    fireEvent.click(screen.getByTestId('request-card-req-1'));
    expect(await screen.findByRole('button', { name: /Start/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull();
  });
});
