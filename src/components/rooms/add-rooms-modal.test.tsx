import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/**
 * Epic 11, Story 11.3 — add rooms (single + bulk range preview). Mirrors the
 * staff/rooms-page harness: mocked api, real English messages, no jest-dom
 * matchers.
 */

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

import { ApiError } from '@/lib/api';
import type { BulkPreview } from '@/lib/types';
import { AddRoomsModal } from './add-rooms-modal';

const ROOM_TYPE = {
  id: 't1',
  nameEn: 'Deluxe',
  nameAr: 'ديلوكس',
  descriptionEn: null,
  descriptionAr: null,
  isActive: true,
  roomsCount: 0,
};

function renderModal(
  overrides: Partial<{ onCreated: () => void; onClose: () => void }> = {},
) {
  const onCreated = overrides.onCreated ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  const utils = render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <AddRoomsModal
        open
        types={[ROOM_TYPE]}
        onClose={onClose}
        onCreated={onCreated}
      />
    </NextIntlClientProvider>,
  );
  return { ...utils, onCreated, onClose };
}

function goToBulkTab() {
  fireEvent.click(screen.getByRole('button', { name: 'Range of rooms' }));
}

async function fillAndPreview(preview: BulkPreview) {
  apiMock.api.mockResolvedValueOnce(preview);
  goToBulkTab();
  fireEvent.change(screen.getByLabelText(/^From/), {
    target: { value: '101' },
  });
  fireEvent.change(screen.getByLabelText(/^To/), {
    target: { value: '104' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  await screen.findByRole('button', { name: /^Create/ });
}

beforeEach(() => {
  apiMock.api.mockReset();
});

describe('AddRoomsModal (11.3)', () => {
  it('AC2 — bulk tab: preview renders the exact list, flags duplicates per number, shows remaining seats', async () => {
    const preview: BulkPreview = {
      rows: [
        {
          row: 1,
          roomNumber: '101',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
        {
          row: 2,
          roomNumber: '102',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: true,
          issues: [],
        },
        {
          row: 3,
          roomNumber: '103',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
        {
          row: 4,
          roomNumber: '104',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
      ],
      validCount: 3,
      duplicateCount: 1,
      invalidCount: 0,
      remaining: 15,
    };
    const { container } = renderModal();
    await fillAndPreview(preview);

    const codes = Array.from(container.querySelectorAll('code')).map(
      (el) => el.textContent,
    );
    expect(codes).toEqual(['101', '102', '103', '104']);

    const duplicateCode = Array.from(container.querySelectorAll('code')).find(
      (el) => el.textContent === '102',
    );
    expect(duplicateCode?.className).toMatch(/line-through/);
    expect(duplicateCode?.getAttribute('title')).toBe('Duplicate');

    expect(screen.getByText('1 duplicate')).toBeTruthy();
    expect(screen.getByText('15 spots left on your plan')).toBeTruthy();
  });

  it('AC2 — confirm posts only non-duplicates with skipDuplicates', async () => {
    const preview: BulkPreview = {
      rows: [
        {
          row: 1,
          roomNumber: '101',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
        {
          row: 2,
          roomNumber: '102',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: true,
          issues: [],
        },
        {
          row: 3,
          roomNumber: '103',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
      ],
      validCount: 2,
      duplicateCount: 1,
      invalidCount: 0,
      remaining: 20,
    };
    const { onCreated, onClose } = renderModal();
    await fillAndPreview(preview);

    // Only two choices at this point: cancel, or confirm (which always means
    // "skip duplicates and create the rest" — 11.3 AC2).
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    const confirmButton = screen.getByRole('button', {
      name: 'Create 2 rooms',
    });

    apiMock.api.mockResolvedValueOnce({ created: 2, skipped: 1 });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const bulkCall = apiMock.api.mock.calls.find(
      ([path]) => path === '/tenant/rooms/bulk',
    );
    expect(bulkCall).toBeTruthy();
    const body = JSON.parse(bulkCall![1].body as string);
    expect(body.skipDuplicates).toBe(true);
    expect(body.skippedCount).toBe(1);
    expect(body.rooms.map((r: { roomNumber: string }) => r.roomNumber)).toEqual(
      ['101', '103'],
    );
    expect(onCreated).toHaveBeenCalled();
  });

  it('AC2 — confirm copy is a plain-language count: "This will create 28 rooms."', async () => {
    const preview: BulkPreview = {
      rows: [
        {
          row: 1,
          roomNumber: '201',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
      ],
      validCount: 28,
      duplicateCount: 0,
      invalidCount: 0,
      remaining: 50,
    };
    renderModal();
    await fillAndPreview(preview);

    expect(screen.getByText('This will create 28 rooms.')).toBeTruthy();
  });

  it('AC3 — 409 ROOM_LIMIT_REACHED renders remaining-seats conversion copy inline', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/^Room number/), {
      target: { value: '101A' },
    });

    apiMock.api.mockRejectedValueOnce(
      new ApiError(
        409,
        "You've reached your plan's room limit.",
        { limit: 20, used: 20, remaining: 0 },
        'ROOM_LIMIT_REACHED',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add room' }));

    expect(
      await screen.findByText(
        "You've reached your plan's room limit. Upgrade your plan to add more rooms.",
      ),
    ).toBeTruthy();
    expect(screen.getByText('0 spots left on your plan')).toBeTruthy();
  });

  it('AC1 — single tab: duplicate number 409 maps to the roomNumber field error', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/^Room number/), {
      target: { value: '101' },
    });

    apiMock.api.mockRejectedValueOnce(
      new ApiError(
        409,
        'That room number is already in use.',
        { roomNumber: '101' },
        'ROOM_NUMBER_TAKEN',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add room' }));

    expect(
      await screen.findByText(
        'That room number is already in use. Choose a different one.',
      ),
    ).toBeTruthy();
  });
});
