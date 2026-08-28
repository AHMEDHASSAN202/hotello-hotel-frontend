import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../messages/en';
import type { TenantAnnouncement } from '@/lib/types';

/** Epic 19, Story 19.1/19.2 — the compose page. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP', timezone: 'Africa/Cairo' } },
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
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
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
});
