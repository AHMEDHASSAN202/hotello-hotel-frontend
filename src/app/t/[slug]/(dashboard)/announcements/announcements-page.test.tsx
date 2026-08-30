import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en';
import type { TenantAnnouncement } from '@/lib/types';

/** Epic 19, Stories 19.2/19.3 — the announcements list page. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { currency: 'EGP', timezone: 'Africa/Cairo' } },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => false),
  dismissHint: vi.fn(),
  undismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'sunrise' }) }));

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

import AnnouncementsPage from './page';

const makeAnnouncement = (o: Partial<TenantAnnouncement> = {}): TenantAnnouncement => ({
  id: 'ann-1',
  titles: { en: 'Pool closed tomorrow', ar: 'المسبح مغلق غدًا', ru: 'Бассейн закрыт' },
  bodies: { en: 'Maintenance 9-12', ar: 'صيانة' },
  infoEntryId: null,
  priority: false,
  audience: { stayTypes: ['all_inclusive'], floors: [2, 3] },
  status: 'live',
  publishAtLocal: null,
  activeUntilLocal: null,
  publishedAt: '2026-01-15T09:00:00.000Z',
  retractedAt: null,
  expiredAt: null,
  createdAt: '2026-01-15T08:00:00.000Z',
  updatedAt: '2026-01-15T09:00:00.000Z',
  audienceStay: null,
  stats: { reads: 34, audienceNow: 62 },
  source: null,
  ...o,
});

function stubApi(rows: TenantAnnouncement[]) {
  apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/tenant/announcements' && !init?.method) return { data: rows };
    if (path.endsWith('/retract') && init?.method === 'POST') return {};
    if (path.endsWith('/send') && init?.method === 'POST') return {};
    if (path.endsWith('/cancel') && init?.method === 'POST') return {};
    throw new Error(`unmocked ${init?.method ?? 'GET'} ${path}`);
  });
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AnnouncementsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.hasPermission.mockReturnValue(true);
  tenant.readOnly = false;
});

describe('AnnouncementsPage', () => {
  it('AC1 (19.3) — renders rows with status badge, audience summary and read stats', async () => {
    stubApi([makeAnnouncement()]);
    renderPage();
    expect(await screen.findByText('Pool closed tomorrow')).toBeTruthy();
    expect(screen.getByText(en.announcements.status.live)).toBeTruthy();
    expect(screen.getByText(/All-Inclusive · Floor 2 · Floor 3/)).toBeTruthy();
    expect(screen.getByText('Read by 34 of 62')).toBeTruthy();
  });

  it('AC2 (19.2) — retract flows through the destructive confirm with ConsequenceNote', async () => {
    stubApi([makeAnnouncement()]);
    renderPage();
    fireEvent.click(await screen.findByText(en.announcements.list.actions.retract));
    expect(screen.getByText(en.announcements.retract.consequence)).toBeTruthy();
    // Row action and modal confirm share the label — the confirm renders last.
    const confirms = screen.getAllByRole('button', {
      name: en.announcements.retract.confirm,
    });
    fireEvent.click(confirms[confirms.length - 1]);
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/announcements/ann-1/retract', {
        method: 'POST',
      }),
    );
  });

  it('AC2 (19.3) — the detail modal shows language tabs, timeline and stats', async () => {
    stubApi([makeAnnouncement()]);
    renderPage();
    fireEvent.click(await screen.findByText('Pool closed tomorrow'));
    // RU has content → enabled tab; FR is empty → disabled.
    const ruTab = screen.getByRole('tab', { name: 'ru' });
    expect(ruTab.hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('tab', { name: 'fr' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(ruTab);
    expect(screen.getByText('Бассейн закрыт')).toBeTruthy();
    expect(screen.getByText(en.announcements.detail.timeline)).toBeTruthy();
    expect(screen.getAllByText('Read by 34 of 62').length).toBeGreaterThan(0);
  });

  it('scheduled rows show hotel-local schedule time and cancel action', async () => {
    stubApi([
      makeAnnouncement({
        id: 'ann-2',
        status: 'scheduled',
        publishedAt: null,
        publishAtLocal: '2030-01-01 09:00',
      }),
    ]);
    renderPage();
    expect(await screen.findByText('Scheduled for 2030-01-01 09:00')).toBeTruthy();
    fireEvent.click(screen.getByText(en.announcements.list.actions.cancel));
    await waitFor(() =>
      expect(apiMock.api).toHaveBeenCalledWith('/tenant/announcements/ann-2/cancel', {
        method: 'POST',
      }),
    );
  });

  it('no permission → the ShieldAlert empty state, no data load', () => {
    tenant.hasPermission.mockReturnValue(false);
    stubApi([]);
    renderPage();
    expect(screen.getByText(en.announcements.noPermission.title)).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('read-only mode disables compose but keeps history visible', async () => {
    tenant.readOnly = true;
    stubApi([makeAnnouncement()]);
    renderPage();
    expect(await screen.findByText('Pool closed tomorrow')).toBeTruthy();
    const compose = screen.getByText(en.announcements.list.compose).closest('button');
    expect(compose?.hasAttribute('disabled')).toBe(true);
    expect(compose?.getAttribute('title')).toBe(en.announcements.readOnlyHint);
  });

  it('Task 18 (21) — badges auto-generated event announcements, not manual ones', async () => {
    stubApi([
      makeAnnouncement({
        id: 'ann-auto',
        source: 'event_publish',
        titles: { en: 'Cooking class starts soon', ar: 'درس الطبخ يبدأ قريبًا' },
      }),
      makeAnnouncement({ id: 'ann-manual', source: null }),
    ]);
    renderPage();
    await screen.findByText('Cooking class starts soon');
    await screen.findByText('Pool closed tomorrow');
    expect(screen.getAllByText(en.announcements.list.autoBadge).length).toBe(1);
    const autoRow = screen.getByTestId('announcement-row-ann-auto');
    const manualRow = screen.getByTestId('announcement-row-ann-manual');
    expect(within(autoRow).queryByText(en.announcements.list.autoBadge)).toBeTruthy();
    expect(within(manualRow).queryByText(en.announcements.list.autoBadge)).toBeNull();
  });

  it('empty state renders the designed empty with CTA', async () => {
    stubApi([]);
    renderPage();
    expect(await screen.findByText(en.announcements.empty.title)).toBeTruthy();
    // Header CTA + empty-state CTA share the label.
    expect(screen.getAllByText(en.announcements.empty.cta).length).toBe(2);
  });
});
