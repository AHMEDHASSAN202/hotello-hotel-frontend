import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { TenantEvent } from '@/lib/types';

/**
 * Task 13 review fix — `CreateEventDto`/`UpdateEventDto` name the title
 * fields `titleEn`/`titleAr`/… (`create-event.dto.ts`, `update-event.dto.ts`),
 * NOT the `nameEn`/`nameAr` convention `NameFields`/`fieldsToPayload` were
 * built around for F&B/hotel-info. A first pass spread `fieldsToPayload`
 * straight into the body, so every create silently 400'd
 * (`EVENT_TITLES_REQUIRED`, both `titleEn`/`titleAr` are `@IsNotEmpty()`) and
 * every edit silently dropped title changes (the fields are `@IsOptional()`
 * on update, so no error — just data loss). This test pins the payload shape
 * so a regression trips a test, not a support ticket.
 */

const tenant = vi.hoisted(() => ({
  isModuleEnabled: vi.fn(() => false),
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/components/tenant-provider', () => ({ useTenant: () => tenant }));

const apiMock = vi.hoisted(() => ({ api: vi.fn(), apiUpload: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  apiUpload: apiMock.apiUpload,
  assetUrl: (p: string | null) => (p ? `http://api/${p}` : null),
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

import { EventModal } from './event-modal';

const EVENT: TenantEvent = {
  id: 'evt-1',
  titles: { en: 'Sunset Yoga', ar: 'يوجا الغروب' },
  descriptions: { en: 'Beach session', ar: 'جلسة على الشاطئ' },
  photoThumbUrl: null,
  photoDetailUrl: null,
  startAtLocal: '2030-01-01 09:00',
  endAtLocal: null,
  locationText: 'Beach — Building B',
  infoEntryId: null,
  capacity: 10,
  price: 0,
  includedFor: [],
  status: 'draft',
  cancelReason: null,
  createdAt: '2026-01-15T08:00:00.000Z',
  updatedAt: '2026-01-15T09:00:00.000Z',
};

function renderModal(event: TenantEvent | null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EventModal event={event} open onClose={onClose} onSaved={onSaved} />
    </NextIntlClientProvider>,
  );
  return { onClose, onSaved, container };
}

beforeEach(() => {
  // jsdom implements neither — PhotoPicker previews the pending file.
  Object.assign(globalThis.URL, {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
  apiMock.api.mockReset();
  apiMock.apiUpload.mockReset();
  tenant.isModuleEnabled.mockReturnValue(false);
  tenant.hasPermission.mockReturnValue(true);
});

describe('EventModal (Task 13)', () => {
  it('create — POSTs titleEn/titleAr (not nameEn/nameAr) to /tenant/events', async () => {
    renderModal(null);

    fireEvent.change(screen.getByLabelText(/Title \(English\)/), {
      target: { value: 'Sunset Yoga' },
    });
    fireEvent.change(screen.getByLabelText(/Title \(Arabic\)/), {
      target: { value: 'يوجا الغروب' },
    });
    fireEvent.change(screen.getByLabelText(/Description \(English\)/), {
      target: { value: 'Beach session' },
    });
    fireEvent.change(screen.getByLabelText(/Description \(Arabic\)/), {
      target: { value: 'جلسة على الشاطئ' },
    });
    fireEvent.change(screen.getByLabelText(/^Start date/), {
      target: { value: '2030-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/^Start time/), {
      target: { value: '09:00' },
    });
    fireEvent.change(screen.getByLabelText(/^Location/), {
      target: { value: 'Beach — Building B' },
    });

    apiMock.api.mockResolvedValueOnce({ id: 'evt-new', photoThumbUrl: null });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await waitFor(() => {
      const post = apiMock.api.mock.calls.find(
        ([path, init]) =>
          path === '/tenant/events' &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(post).toBeTruthy();
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body).toMatchObject({
        titleEn: 'Sunset Yoga',
        titleAr: 'يوجا الغروب',
        descriptionEn: 'Beach session',
        descriptionAr: 'جلسة على الشاطئ',
        startAtLocal: '2030-01-01 09:00',
        locationText: 'Beach — Building B',
      });
      expect(body).not.toHaveProperty('nameEn');
      expect(body).not.toHaveProperty('nameAr');
      expect(body).not.toHaveProperty('nameRu');
    });
  });

  it('edit — PATCHes the changed title as titleEn/titleAr (not nameEn/nameAr) to /tenant/events/:id', async () => {
    renderModal(EVENT);

    fireEvent.change(screen.getByLabelText(/Title \(English\)/), {
      target: { value: 'Sunrise Yoga' },
    });

    apiMock.api.mockResolvedValueOnce({ ...EVENT, titles: { en: 'Sunrise Yoga', ar: EVENT.titles.ar } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => {
      const patch = apiMock.api.mock.calls.find(
        ([path, init]) =>
          path === '/tenant/events/evt-1' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse(String((patch![1] as RequestInit).body));
      expect(body.titleEn).toBe('Sunrise Yoga');
      expect(body.titleAr).toBe('يوجا الغروب');
      expect(body.descriptionEn).toBe('Beach session');
      expect(body).not.toHaveProperty('nameEn');
      expect(body).not.toHaveProperty('nameAr');
    });
  });

  it('draft — lowering the capacity submits (the safe-edit lock is published-only)', async () => {
    // `assertEditable` returns early for drafts: everything is editable,
    // capacity decreases included. The client-side guard used to fire
    // regardless of status and told the user "this event is live" about an
    // unpublished draft.
    renderModal({ ...EVENT, capacity: 50, status: 'draft' });

    fireEvent.change(screen.getByLabelText(/^Capacity/), {
      target: { value: '30' },
    });

    apiMock.api.mockResolvedValueOnce({ ...EVENT, capacity: 30 });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => {
      const patch = apiMock.api.mock.calls.find(
        ([path, init]) =>
          path === '/tenant/events/evt-1' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      expect(JSON.parse(String((patch![1] as RequestInit).body)).capacity).toBe(30);
    });
    expect(screen.queryByText(/already live/i)).toBeNull();
  });

  it('published — lowering the capacity is still blocked with the live-event copy', async () => {
    const { container } = renderModal({
      ...EVENT,
      capacity: 50,
      status: 'published',
    });

    const capacity = screen.getByLabelText(/^Capacity/) as HTMLInputElement;
    // First line of defence: the input floors at the current capacity (a
    // click on Save can't even submit — native constraint validation).
    expect(capacity.min).toBe('50');

    fireEvent.change(capacity, { target: { value: '30' } });
    // Submit the form directly to get past that native block and exercise
    // the JS guard itself — the one that must still speak up here.
    fireEvent.submit(container.querySelector('form')!);

    expect(
      await screen.findByText(
        en.events.form.capacityDecreaseError.replace('{current}', '50'),
      ),
    ).toBeTruthy();
    expect(apiMock.api.mock.calls.some(([, init]) => init)).toBe(false);
  });

  it('published + currently UNLIMITED — the toggle is locked and the only legal capacity (null) is what ships', async () => {
    // `assertEditable`: on a published event capacity may change only to
    // `null`, or — when the current capacity is FINITE — to a value >= it.
    // Currently unlimited therefore admits exactly one value: unchanged. The
    // old guard required `currentCapacity !== null`, so it never fired here
    // and the form happily invited a finite capacity straight into a 409.
    renderModal({ ...EVENT, capacity: null, status: 'published' });

    const unlimited = screen.getByLabelText(
      'Unlimited attendance',
    ) as HTMLInputElement;
    expect(unlimited.checked).toBe(true);
    expect(unlimited.disabled).toBe(true);
    // Explained where the control is, not as a generic banner after a 409.
    expect(
      screen.getByText(en.events.form.capacityFromUnlimitedError),
    ).toBeTruthy();
    // With the toggle locked there is no capacity input to fill in at all.
    expect(screen.queryByLabelText(/^Capacity/)).toBeNull();

    apiMock.api.mockResolvedValueOnce({ ...EVENT, capacity: null });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => {
      const patch = apiMock.api.mock.calls.find(
        ([path, init]) =>
          path === '/tenant/events/evt-1' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      expect(JSON.parse(String((patch![1] as RequestInit).body)).capacity).toBe(
        null,
      );
    });
  });

  it('published + FINITE capacity — the unlimited toggle stays open (finite → unlimited is legal)', () => {
    renderModal({ ...EVENT, capacity: 50, status: 'published' });
    expect(
      (screen.getByLabelText('Unlimited attendance') as HTMLInputElement)
        .disabled,
    ).toBe(false);
    expect(
      screen.queryByText(en.events.form.capacityFromUnlimitedError),
    ).toBeNull();
  });

  it('draft + unlimited — nothing is locked (the safe-edit matrix is published-only)', () => {
    renderModal({ ...EVENT, capacity: null, status: 'draft' });
    expect(
      (screen.getByLabelText('Unlimited attendance') as HTMLInputElement)
        .disabled,
    ).toBe(false);
    expect(
      screen.queryByText(en.events.form.capacityFromUnlimitedError),
    ).toBeNull();
  });

  it('published edit — the PATCH body omits every restricted key, not just avoids a 409', async () => {
    // The safe-edit matrix keys off "field present in the DTO", so a payload
    // that carries an unchanged `price`/`startAtLocal` still 409s
    // (`EVENT_NOT_SAFE_EDIT`). Assert on the payload's actual keys — the
    // silent-drift bug class this epic already shipped once (nameEn/titleEn)
    // is invisible to a "no error" assertion.
    renderModal({ ...EVENT, status: 'published' });

    fireEvent.change(screen.getByLabelText(/Title \(English\)/), {
      target: { value: 'Sunrise Yoga' },
    });

    apiMock.api.mockResolvedValueOnce({ ...EVENT, status: 'published' });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => {
      const patch = apiMock.api.mock.calls.find(
        ([path, init]) =>
          path === '/tenant/events/evt-1' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse(String((patch![1] as RequestInit).body));
      for (const key of [
        'startAtLocal',
        'endAtLocal',
        'price',
        'includedFor',
        'locationText',
        'infoEntryId',
      ]) {
        expect(Object.keys(body)).not.toContain(key);
      }
      // What a published event MAY change still rides along.
      expect(Object.keys(body).sort()).toEqual(
        [
          'capacity',
          'descriptionAr',
          'descriptionEn',
          'titleAr',
          'titleEn',
        ].sort(),
      );
      expect(body.titleEn).toBe('Sunrise Yoga');
    });
  });

  it('create + failed photo upload — the retry PATCHes the created event instead of POSTing a duplicate', async () => {
    renderModal(null);

    fireEvent.change(screen.getByLabelText(/Title \(English\)/), {
      target: { value: 'Sunset Yoga' },
    });
    fireEvent.change(screen.getByLabelText(/Title \(Arabic\)/), {
      target: { value: 'يوجا الغروب' },
    });
    fireEvent.change(screen.getByLabelText(/Description \(English\)/), {
      target: { value: 'Beach session' },
    });
    fireEvent.change(screen.getByLabelText(/Description \(Arabic\)/), {
      target: { value: 'جلسة على الشاطئ' },
    });
    fireEvent.change(screen.getByLabelText(/^Start date/), {
      target: { value: '2030-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/^Start time/), {
      target: { value: '09:00' },
    });
    fireEvent.change(screen.getByLabelText(/^Location/), {
      target: { value: 'Beach — Building B' },
    });
    const photo = new File(['x'], 'event.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [photo] },
    });

    apiMock.api.mockResolvedValueOnce({ id: 'evt-new', photoThumbUrl: null });
    apiMock.apiUpload.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await waitFor(() => expect(apiMock.apiUpload).toHaveBeenCalledTimes(1));
    // The modal is still open — but the event now EXISTS, so the button must
    // stop promising to create one (it PATCHes from here on).
    await screen.findByRole('button', { name: 'Save event' });
    expect(screen.queryByRole('button', { name: 'Create event' })).toBeNull();

    apiMock.api.mockResolvedValueOnce({ id: 'evt-new', photoThumbUrl: null });
    apiMock.apiUpload.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => expect(apiMock.apiUpload).toHaveBeenCalledTimes(2));
    const posts = apiMock.api.mock.calls.filter(
      ([path, init]) =>
        path === '/tenant/events' &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    const patches = apiMock.api.mock.calls.filter(
      ([path, init]) =>
        path === '/tenant/events/evt-new' &&
        (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(posts).toHaveLength(1);
    expect(patches).toHaveLength(1);
    expect(apiMock.apiUpload.mock.calls[1][0]).toBe('/tenant/events/evt-new/photo');
  });

  it('clearing a previously saved optional-language title sends it as "" so the backend deletes it', async () => {
    // `mergeTranslations` (tenant-events.service.ts) only deletes a language
    // when the key ARRIVES as an empty string; an omitted key keeps the
    // stored value, so blanking Russian used to be silently discarded.
    renderModal({
      ...EVENT,
      titles: { en: 'Sunset Yoga', ar: 'يوجا الغروب', ru: 'Йога' },
    });

    fireEvent.click(screen.getByRole('button', { name: /more languages/i }));
    fireEvent.change(screen.getByDisplayValue('Йога'), {
      target: { value: '' },
    });

    apiMock.api.mockResolvedValueOnce({ ...EVENT });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => {
      const patch = apiMock.api.mock.calls.find(
        ([path, init]) =>
          path === '/tenant/events/evt-1' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse(String((patch![1] as RequestInit).body));
      expect(body).toHaveProperty('titleRu', '');
    });
  });

  it('an optional language that was never set is still omitted (no empty-string noise)', async () => {
    renderModal(EVENT);

    fireEvent.change(screen.getByLabelText(/Title \(English\)/), {
      target: { value: 'Sunrise Yoga' },
    });

    apiMock.api.mockResolvedValueOnce({ ...EVENT });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => {
      const patch = apiMock.api.mock.calls.find(
        ([path, init]) =>
          path === '/tenant/events/evt-1' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse(String((patch![1] as RequestInit).body));
      expect(body).not.toHaveProperty('titleRu');
      expect(body).not.toHaveProperty('titleFr');
    });
  });

  it('caps the title and description inputs at the backend maxima (120 / 2000)', () => {
    renderModal(null);
    expect(
      (screen.getByLabelText(/Title \(English\)/) as HTMLInputElement).maxLength,
    ).toBe(120);
    expect(
      (screen.getByLabelText(/Title \(Arabic\)/) as HTMLInputElement).maxLength,
    ).toBe(120);
    expect(
      (screen.getByLabelText(/Description \(English\)/) as HTMLInputElement)
        .maxLength,
    ).toBe(2000);
    expect(
      (screen.getByLabelText(/^Location/) as HTMLInputElement).maxLength,
    ).toBe(200);
  });

  it('final-review fix (Minor) — reopening an "included" event with price 0 selects Included, not Free', () => {
    // price === 0 AND includedFor non-empty: the includedFor check must win
    // so the selection survives a reopen instead of silently reverting to
    // 'free' (which would drop includedFor on the next save).
    renderModal({
      ...EVENT,
      price: 0,
      includedFor: ['room_only'],
      status: 'published',
    });
    const included = screen.getByRole('radio', {
      name: 'Included for selected stay types',
    }) as HTMLInputElement;
    const free = screen.getByRole('radio', {
      name: 'Free for everyone',
    }) as HTMLInputElement;
    expect(included.checked).toBe(true);
    expect(free.checked).toBe(false);
  });
});
