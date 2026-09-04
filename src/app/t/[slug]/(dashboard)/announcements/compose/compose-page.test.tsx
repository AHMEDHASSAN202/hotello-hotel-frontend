import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { TenantAnnouncement } from '@/lib/types';

/** Epic 19, Story 19.1/19.2 — the compose page. Epic 23, Story 23.3 — the push toggle + quiet-hours hint. */

const tenant = vi.hoisted(() => ({
  me: {
    user: { id: 'u1' },
    hotel: {
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      pushQuietHours: { start: '22:00', end: '08:00' },
    },
  },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => false),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
}));

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchId: null as string | null,
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
  // Stable reference across renders — matching real Next.js `useRouter()`.
  // A fresh object literal here would change identity every render, and
  // page.tsx's edit-load effect depends on `router`: an unstable mock turns
  // that effect into an infinite re-fire loop the instant `editId` is set
  // (never exercised before this file's first edit-mode test).
  useRouter: () => nav,
  useSearchParams: () => ({ get: (key: string) => (key === 'id' ? nav.searchId : null) }),
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

import ComposeAnnouncementPage from './page';

function stubApi({
  list = [] as TenantAnnouncement[],
  editRow = null as TenantAnnouncement | null,
} = {}) {
  apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/tenant/hotel-info') {
      return {
        checkoutTime: '12:00',
        essentials: null,
        facilities: [
          { id: 'entry-1', section: 'facilities', names: { en: 'Pool', ar: 'المسبح' }, descriptions: null, structured: {}, photos: [], sortOrder: 0, isActive: true },
        ],
        services: [],
        houseRules: [],
        about: null,
      };
    }
    if (path === '/tenant/announcements' && !init?.method) return { data: list };
    if (path === '/tenant/announcements' && init?.method === 'POST') return { id: 'ann-new' };
    if (editRow && path === `/tenant/announcements/${editRow.id}` && !init?.method) {
      return editRow;
    }
    if (editRow && path === `/tenant/announcements/${editRow.id}` && init?.method === 'PATCH') {
      return editRow;
    }
    if (path.startsWith('/tenant/rooms')) {
      return { data: [], total: 0, page: 1, pageSize: 200, usage: { used: 0, max: null } };
    }
    if (path === '/tenant/announcements/audience/preview') return { count: 5 };
    if (path.startsWith('/tenant/stays')) return { data: [], total: 0 };
    throw new Error(`unmocked ${init?.method ?? 'GET'} ${path}`);
  });
}

const liveAnnouncement = {
  id: 'ann-live',
  status: 'live',
  priority: true,
} as TenantAnnouncement;

/** 23.3 — a draft where the operator explicitly turned push off despite priority. */
const editDraftAnnouncement = {
  id: 'ann-draft',
  status: 'draft',
  titles: { en: 'Pool closed', ar: 'المسبح مغلق', ru: null, fr: null, it: null, es: null, de: null },
  bodies: { en: 'Maintenance 9-12', ar: 'صيانة', ru: null, fr: null, it: null, es: null, de: null },
  infoEntryId: null,
  priority: true,
  sendPush: false,
  audience: {},
  publishAtLocal: null,
  activeUntilLocal: null,
  publishedAt: null,
  retractedAt: null,
  expiredAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  audienceStay: null,
  stats: { reads: 0, audienceNow: 0 },
  source: null,
} as unknown as TenantAnnouncement;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <ComposeAnnouncementPage />
    </NextIntlClientProvider>,
  );
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/Title \(English\)/), {
    target: { value: 'Pool closed' },
  });
  fireEvent.change(screen.getByLabelText(/Title \(Arabic\)/), {
    target: { value: 'المسبح مغلق' },
  });
  fireEvent.change(screen.getByLabelText(/Message \(English\)/), {
    target: { value: 'Maintenance 9-12' },
  });
  fireEvent.change(screen.getByLabelText(/Message \(Arabic\)/), {
    target: { value: 'صيانة' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
  nav.searchId = null;
  stubApi();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ComposeAnnouncementPage', () => {
  it('19.1 AC1 — send-now posts the flat payload with action send', async () => {
    renderPage();
    fillRequired();
    const submit = screen.getByRole('button', { name: en.announcements.compose.submitSend });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
    fireEvent.click(submit);
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith(
        '/tenant/announcements',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const call = apiMock.api.mock.calls.find(
      ([p, init]) => p === '/tenant/announcements' && (init as RequestInit)?.method === 'POST',
    );
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      action: 'send',
      titleEn: 'Pool closed',
      titleAr: 'المسبح مغلق',
      bodyEn: 'Maintenance 9-12',
      priority: false,
      audience: {},
    });
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/t/sunrise/announcements'));
  });

  it('19.2 AC1 — schedule mode requires a date and time before submit enables', async () => {
    renderPage();
    fillRequired();
    fireEvent.click(screen.getByRole('radio', { name: en.announcements.compose.modeSchedule }));
    const submit = screen.getByRole('button', {
      name: en.announcements.compose.submitSchedule,
    });
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText(/Publish date/), {
      target: { value: '2030-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/Publish time/), {
      target: { value: '09:00' },
    });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
    fireEvent.click(submit);
    await waitFor(() => {
      const call = apiMock.api.mock.calls.find(
        ([p, init]) => p === '/tenant/announcements' && (init as RequestInit)?.method === 'POST',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body).toMatchObject({ action: 'schedule', publishAtLocal: '2030-01-01 09:00' });
    });
  });

  it('spec note 7 — the priority nudge appears only when another priority notice is live', async () => {
    stubApi({ list: [liveAnnouncement] });
    renderPage();
    fillRequired();
    // The InfoTip button shares the label — target the checkbox role.
    fireEvent.click(screen.getByRole('checkbox', { name: /Mark as important/ }));
    const submit = screen.getByRole('button', { name: en.announcements.compose.submitSend });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
    fireEvent.click(submit);
    // No POST yet — the soft nudge intercepts.
    expect(
      apiMock.api.mock.calls.find(
        ([p, init]) => p === '/tenant/announcements' && (init as RequestInit)?.method === 'POST',
      ),
    ).toBeUndefined();
    expect(await screen.findByText(en.announcements.nudge.title)).toBeTruthy();
    fireEvent.click(screen.getByText(en.announcements.nudge.confirm));
    await waitFor(() =>
      expect(
        apiMock.api.mock.calls.find(
          ([p, init]) => p === '/tenant/announcements' && (init as RequestInit)?.method === 'POST',
        ),
      ).toBeTruthy(),
    );
  });

  it('no permission → the ShieldAlert empty state', () => {
    tenant.hasPermission.mockReturnValue(false);
    renderPage();
    expect(screen.getByText(en.announcements.noPermission.title)).toBeTruthy();
  });

  describe('23.3 AC1 — sendPush toggle', () => {
    it('untouched: flips ON automatically when priority is checked', async () => {
      renderPage();
      fillRequired();
      const pushCheckbox = screen.getByRole('checkbox', {
        name: /Send a push notification/,
      }) as HTMLInputElement;
      expect(pushCheckbox.checked).toBe(false);
      fireEvent.click(screen.getByRole('checkbox', { name: /Mark as important/ }));
      await waitFor(() => expect(pushCheckbox.checked).toBe(true));
    });

    it('touched: stops following priority once the operator overrides it', async () => {
      renderPage();
      fillRequired();
      const priorityCheckbox = screen.getByRole('checkbox', { name: /Mark as important/ });
      const pushCheckbox = screen.getByRole('checkbox', {
        name: /Send a push notification/,
      }) as HTMLInputElement;

      // Priority ON first — push auto-follows to true (still untouched).
      fireEvent.click(priorityCheckbox);
      await waitFor(() => expect(pushCheckbox.checked).toBe(true));

      // Operator explicitly turns push OFF — this is the touch.
      fireEvent.click(pushCheckbox);
      expect(pushCheckbox.checked).toBe(false);

      // Toggling priority OFF then back ON must NOT re-enable push.
      fireEvent.click(priorityCheckbox);
      fireEvent.click(priorityCheckbox);
      expect(pushCheckbox.checked).toBe(false);
    });

    it('the submitted POST body carries the current sendPush value', async () => {
      renderPage();
      fillRequired();
      const submit = screen.getByRole('button', { name: en.announcements.compose.submitSend });
      await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
      fireEvent.click(submit);
      await waitFor(() => {
        const call = apiMock.api.mock.calls.find(
          ([p, init]) =>
            p === '/tenant/announcements' && (init as RequestInit)?.method === 'POST',
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string);
        expect(body).toMatchObject({ sendPush: false });
      });
    });

    it('edit mode hydrates sendPush from the loaded row and never re-derives it from priority', async () => {
      stubApi({ editRow: editDraftAnnouncement });
      nav.searchId = editDraftAnnouncement.id;
      renderPage();

      const priorityCheckbox = (await screen.findByRole('checkbox', {
        name: /Mark as important/,
      })) as HTMLInputElement;
      const pushCheckbox = screen.getByRole('checkbox', {
        name: /Send a push notification/,
      }) as HTMLInputElement;

      // The row was priority=true, sendPush=false — the operator's explicit choice.
      expect(priorityCheckbox.checked).toBe(true);
      expect(pushCheckbox.checked).toBe(false);

      // Re-toggling priority must not re-derive push from it post-hydrate.
      fireEvent.click(priorityCheckbox);
      fireEvent.click(priorityCheckbox);
      expect(pushCheckbox.checked).toBe(false);

      const submit = screen.getByRole('button', { name: en.announcements.compose.submitSave });
      fireEvent.click(submit);
      await waitFor(() => {
        const call = apiMock.api.mock.calls.find(
          ([p, init]) =>
            p === `/tenant/announcements/${editDraftAnnouncement.id}` &&
            (init as RequestInit)?.method === 'PATCH',
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string);
        expect(body).toMatchObject({ sendPush: false });
      });
    });
  });

  describe('23.3 AC4 — quiet-hours hint', () => {
    it('schedule mode: shows inside the window, hides at the exclusive end boundary and outside it', async () => {
      renderPage();
      fillRequired();
      fireEvent.click(screen.getByRole('checkbox', { name: /Send a push notification/ }));
      fireEvent.click(screen.getByRole('radio', { name: en.announcements.compose.modeSchedule }));
      fireEvent.change(screen.getByLabelText(/Publish date/), {
        target: { value: '2030-01-01' },
      });

      // Inside the 22:00–08:00 window (crosses midnight).
      fireEvent.change(screen.getByLabelText(/Publish time/), { target: { value: '23:30' } });
      expect(
        screen.getByText('This will arrive after quiet hours end (22:00–08:00) — priority notices skip this'),
      ).toBeTruthy();

      // Exact end — treated as quiet hours already over (exclusive boundary).
      fireEvent.change(screen.getByLabelText(/Publish time/), { target: { value: '08:00' } });
      expect(screen.queryByText(/quiet hours end/)).toBeNull();

      // Clearly outside the window.
      fireEvent.change(screen.getByLabelText(/Publish time/), { target: { value: '08:30' } });
      expect(screen.queryByText(/quiet hours end/)).toBeNull();

      // Priority notices skip quiet hours entirely, even inside the window.
      fireEvent.change(screen.getByLabelText(/Publish time/), { target: { value: '23:30' } });
      expect(screen.getByText(/quiet hours end/)).toBeTruthy();
      fireEvent.click(screen.getByRole('checkbox', { name: /Mark as important/ }));
      expect(screen.queryByText(/quiet hours end/)).toBeNull();
    });

    it('send-now mode: reflects the current hotel-local time via Intl, not toISOString', async () => {
      vi.useFakeTimers();
      // 2026-01-15T20:30:00Z is 22:30 in Africa/Cairo (winter, UTC+2) — inside quiet hours.
      vi.setSystemTime(new Date('2026-01-15T20:30:00Z'));
      renderPage();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      fillRequired();
      fireEvent.click(screen.getByRole('checkbox', { name: /Send a push notification/ }));
      expect(screen.getByText(/quiet hours end/)).toBeTruthy();
    });
  });
});
