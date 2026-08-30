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
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EventModal event={event} open onClose={onClose} onSaved={onSaved} />
    </NextIntlClientProvider>,
  );
  return { onClose, onSaved };
}

beforeEach(() => {
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
});
