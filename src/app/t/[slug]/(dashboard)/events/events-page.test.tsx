import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en';
import type { TenantEventListItem } from '@/lib/types';

/** Epic 21, Story 21.2 AC4 — the events management list page. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP', timezone: 'Africa/Cairo' } },
  hasPermission: vi.fn(() => true),
  // The event modal (Task 13) checks this to decide whether to show/fetch
  // the optional Hotel Info entry picker — the modal stays closed in these
  // list-page tests, but its component body still runs on every render.
  isModuleEnabled: vi.fn(() => false),
  readOnly: false,
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));

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

import EventsPage from './page';

const makeEvent = (
  o: Partial<TenantEventListItem> = {},
): TenantEventListItem => ({
  id: 'evt-1',
  titles: { en: 'Sunset Yoga', ar: 'يوجا الغروب' },
  descriptions: { en: 'Beachside session', ar: 'جلسة على الشاطئ' },
  photoThumbUrl: null,
  photoDetailUrl: null,
  startAtLocal: '2030-01-01 09:00',
  endAtLocal: null,
  locationText: 'Beach — Building B',
  infoEntryId: null,
  capacity: 10,
  price: 0,
  includedFor: [],
  status: 'published',
  cancelReason: null,
  createdAt: '2026-01-15T08:00:00.000Z',
  updatedAt: '2026-01-15T09:00:00.000Z',
  bookedCount: 4,
  ...o,
});

function stubApi(rows: TenantEventListItem[]) {
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.startsWith('/tenant/events?tab=')) return { data: rows };
    throw new Error(`unmocked GET ${path}`);
  });
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EventsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
});

describe('EventsPage', () => {
  it('renders rows with title, status badge, start time and bounded capacity', async () => {
    stubApi([makeEvent()]);
    renderPage();
    expect(await screen.findByText('Sunset Yoga')).toBeTruthy();
    expect(screen.getByText(en.events.status.published)).toBeTruthy();
    expect(screen.getByText('Starts 2030-01-01 09:00')).toBeTruthy();
    expect(screen.getByText('4 / 10')).toBeTruthy();
    expect(apiMock.api).toHaveBeenCalledWith('/tenant/events?tab=upcoming');
  });

  it('unlimited capacity shows "{booked} booked" instead of a fraction', async () => {
    stubApi([makeEvent({ capacity: null, bookedCount: 7 })]);
    renderPage();
    expect(await screen.findByText('7 booked')).toBeTruthy();
  });

  it('draft rows show edit + publish; published rows show edit + cancel', async () => {
    stubApi([makeEvent({ id: 'evt-draft', status: 'draft' })]);
    renderPage();
    await screen.findByText('Sunset Yoga');
    expect(
      screen.getByText(en.events.list.actions.edit),
    ).toBeTruthy();
    expect(
      screen.getByText(en.events.list.actions.publish),
    ).toBeTruthy();
    expect(screen.queryByText(en.events.list.actions.cancel)).toBeNull();
  });

  it('completed/cancelled rows have no row actions', async () => {
    stubApi([makeEvent({ status: 'completed' })]);
    renderPage();
    await screen.findByText('Sunset Yoga');
    expect(screen.queryByText(en.events.list.actions.edit)).toBeNull();
    expect(screen.queryByText(en.events.list.actions.publish)).toBeNull();
    expect(screen.queryByText(en.events.list.actions.cancel)).toBeNull();
  });

  it('switching tabs reloads from the tab-specific endpoint', async () => {
    stubApi([makeEvent()]);
    renderPage();
    await screen.findByText('Sunset Yoga');
    fireEvent.click(screen.getByText(en.events.list.tabs.past));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/events?tab=past'),
    );
  });

  it('no permission → the ShieldAlert empty state, no data load', () => {
    tenant.hasPermission.mockReturnValue(false);
    stubApi([]);
    renderPage();
    expect(screen.getByText(en.events.noAccess.title)).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('read-only mode disables the create-event CTA', async () => {
    tenant.readOnly = true;
    stubApi([makeEvent()]);
    renderPage();
    await screen.findByText('Sunset Yoga');
    const create = screen
      .getByText(en.events.list.createEvent)
      .closest('button');
    expect(create?.hasAttribute('disabled')).toBe(true);
    expect(create?.getAttribute('title')).toBe(en.events.readOnlyHint);
  });

  it('no events.manage permission hides the create CTA and row actions', async () => {
    tenant.hasPermission.mockImplementation((key: string) => key === 'events.read');
    stubApi([makeEvent({ status: 'draft' })]);
    renderPage();
    await screen.findByText('Sunset Yoga');
    expect(screen.queryByText(en.events.list.createEvent)).toBeNull();
    expect(screen.queryByText(en.events.list.actions.edit)).toBeNull();
  });

  it('truly-empty upcoming tab shows the onboarding empty state with a CTA', async () => {
    stubApi([]);
    renderPage();
    expect(await screen.findByText(en.events.list.empty.upcomingTitle)).toBeTruthy();
    // Header CTA + empty-state CTA share the label.
    expect(screen.getAllByText(en.events.list.createEvent).length).toBe(2);
  });

  it('empty past tab shows the categorical empty state without a CTA', async () => {
    stubApi([]);
    renderPage();
    await screen.findByText(en.events.list.empty.upcomingTitle);
    fireEvent.click(screen.getByText(en.events.list.tabs.past));
    expect(await screen.findByText(en.events.list.empty.pastTitle)).toBeTruthy();
    // Only the header CTA remains — the categorical empty state has none of its own.
    expect(screen.getAllByText(en.events.list.createEvent).length).toBe(1);
  });
});
