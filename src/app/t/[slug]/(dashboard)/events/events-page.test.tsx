import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  // Final-review fix (Important 4) — the HintCard added to this page reads
  // these; dismissed by default so it doesn't crowd out the row assertions
  // below (a dedicated test flips this to exercise the card itself).
  isHintDismissed: vi.fn(() => true),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
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

  it('the events HintCard surfaces the safe-edit-lock guidance and can be dismissed', async () => {
    tenant.isHintDismissed.mockReturnValue(false);
    stubApi([makeEvent()]);
    renderPage();
    await screen.findByText('Sunset Yoga');
    expect(screen.getByText(en.guidance.events.hint.title)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(en.guidance.common.dismiss));
    expect(tenant.dismissHint).toHaveBeenCalledWith('events.firstRun');
  });
});

/**
 * Task 14 review fix (final-review Important 3) — publish/cancel had zero
 * test coverage despite this exact feature already shipping one silent
 * wrong-payload bug on this branch (commit 0612c5d, titleEn/titleAr vs
 * nameEn/nameAr). These pin the request bodies and the untested cancel
 * validation branch.
 */
describe('EventsPage — publish/cancel confirm flows (Task 14, final-review Important 3)', () => {
  it('publish defaults the announce checkbox on and posts {announce: true}', async () => {
    const draft = makeEvent({ id: 'evt-1', status: 'draft' });
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/tenant/events?tab=')) return { data: [draft] };
      if (path === '/tenant/events/evt-1/publish' && init?.method === 'POST')
        return {};
      throw new Error(`unmocked ${path} ${init?.method ?? 'GET'}`);
    });
    renderPage();
    await screen.findByText('Sunset Yoga');
    fireEvent.click(screen.getByText(en.events.list.actions.publish));

    const dialog = await screen.findByRole('dialog', {
      name: en.events.publish.title,
    });
    const checkbox = within(dialog).getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(
      within(dialog).getByRole('button', { name: en.events.publish.confirm }),
    );

    await waitFor(() => {
      const call = apiMock.api.mock.calls.find(
        ([p]) => p === '/tenant/events/evt-1/publish',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse(String((call![1] as RequestInit).body));
      expect(body).toEqual({ announce: true });
    });
  });

  it('unchecking "announce" before confirming publish posts {announce: false}', async () => {
    const draft = makeEvent({ id: 'evt-1', status: 'draft' });
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/tenant/events?tab=')) return { data: [draft] };
      if (path === '/tenant/events/evt-1/publish' && init?.method === 'POST')
        return {};
      throw new Error(`unmocked ${path} ${init?.method ?? 'GET'}`);
    });
    renderPage();
    await screen.findByText('Sunset Yoga');
    fireEvent.click(screen.getByText(en.events.list.actions.publish));

    const dialog = await screen.findByRole('dialog', {
      name: en.events.publish.title,
    });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(
      within(dialog).getByRole('button', { name: en.events.publish.confirm }),
    );

    await waitFor(() => {
      const call = apiMock.api.mock.calls.find(
        ([p]) => p === '/tenant/events/evt-1/publish',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse(String((call![1] as RequestInit).body));
      expect(body).toEqual({ announce: false });
    });
  });

  it('cancelling with an empty/whitespace-only reason shows the inline error and issues no API call', async () => {
    const published = makeEvent({
      id: 'evt-1',
      status: 'published',
      bookedCount: 3,
    });
    stubApi([published]);
    renderPage();
    await screen.findByText('Sunset Yoga');
    fireEvent.click(screen.getByText(en.events.list.actions.cancel));

    const dialog = await screen.findByRole('dialog', {
      name: en.events.cancel.title,
    });
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: '   ' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: en.events.cancel.confirm }),
    );

    expect(
      await within(dialog).findByText(en.events.cancel.reasonRequired),
    ).toBeTruthy();
    expect(
      apiMock.api.mock.calls.some(([p]) => String(p).includes('/cancel')),
    ).toBe(false);
  });

  it('cancelling with a valid reason posts {reason} and shows the correct pluralized booked count', async () => {
    const published = makeEvent({
      id: 'evt-1',
      status: 'published',
      bookedCount: 2,
    });
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/tenant/events?tab=')) return { data: [published] };
      if (path === '/tenant/events/evt-1/cancel' && init?.method === 'POST')
        return {};
      throw new Error(`unmocked ${path} ${init?.method ?? 'GET'}`);
    });
    renderPage();
    await screen.findByText('Sunset Yoga');
    fireEvent.click(screen.getByText(en.events.list.actions.cancel));

    const dialog = await screen.findByRole('dialog', {
      name: en.events.cancel.title,
    });
    // bookedCount: 2 → the ICU "other" plural branch.
    expect(
      within(dialog).getByText(/2 guests have booked this event/),
    ).toBeTruthy();

    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Venue became unavailable' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: en.events.cancel.confirm }),
    );

    await waitFor(() => {
      const call = apiMock.api.mock.calls.find(
        ([p]) => p === '/tenant/events/evt-1/cancel',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse(String((call![1] as RequestInit).body));
      expect(body).toEqual({ reason: 'Venue became unavailable' });
    });
  });
});
