import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/**
 * Final-review fix (Epic 11 whole-branch review, finding 8) — Story 11.4 AC1
 * ships two ConsequenceNote triggers on the edit-room form (renumberWarning,
 * countability) but neither had a component test. Mirrors the
 * add-rooms-modal/room-qr-modal harness: mocked api, real English messages.
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

import type { Room, RoomType } from '@/lib/types';
import { EditRoomModal } from './edit-room-modal';

const ROOM_TYPE: RoomType = {
  id: 't1',
  nameEn: 'Deluxe',
  nameAr: 'ديلوكس',
  descriptionEn: null,
  descriptionAr: null,
  isActive: true,
  roomsCount: 1,
};

const ROOM: Room = {
  id: 'room-1',
  roomNumber: '101',
  floor: 1,
  status: 'active',
  roomType: { id: 't1', nameEn: 'Deluxe', nameAr: 'ديلوكس' },
};

const RENUMBER_WARNING =
  "Changing this room's number invalidates any cards already printed with the old number — reprint them so guests scan the right room.";
const INACTIVE_NOTE =
  "Hidden from guests and doesn't count toward your plan's room limit. Use this for rooms removed from service long-term.";

/**
 * The status toggle button and its adjacent InfoTip trigger both resolve to
 * the same accessible name (visible text vs. `aria-label`), so `getByRole`
 * alone is ambiguous — select the one that carries `aria-pressed`.
 */
function statusToggle(name: string) {
  return screen
    .getAllByRole('button', { name })
    .find((el) => el.hasAttribute('aria-pressed'))!;
}

function renderModal(room: Room | null = ROOM) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EditRoomModal
        room={room}
        types={[ROOM_TYPE]}
        onClose={onClose}
        onSaved={onSaved}
      />
    </NextIntlClientProvider>,
  );
  return { ...utils, onClose, onSaved };
}

beforeEach(() => {
  apiMock.api.mockReset();
});

describe('EditRoomModal (11.4 AC1)', () => {
  it('editing the room number reveals the danger ConsequenceNote with the printed-card warning', () => {
    renderModal();

    expect(screen.queryByText(RENUMBER_WARNING)).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Room number/), {
      target: { value: '102' },
    });

    expect(screen.getByText(RENUMBER_WARNING)).toBeTruthy();
  });

  it('switching status from active to inactive reveals the countability ConsequenceNote', () => {
    renderModal();

    expect(screen.queryByText(INACTIVE_NOTE)).toBeNull();

    fireEvent.click(statusToggle('Inactive'));

    expect(screen.getByText(INACTIVE_NOTE)).toBeTruthy();
  });

  it('a lateral active → out_of_service change shows no ConsequenceNote', () => {
    renderModal();

    fireEvent.click(statusToggle('Out of service'));

    expect(screen.queryByText(RENUMBER_WARNING)).toBeNull();
    expect(screen.queryByText(INACTIVE_NOTE)).toBeNull();
    expect(
      screen.queryByText(
        "Temporarily unavailable to guests — use this for rooms under maintenance. Still counts toward your plan's room limit.",
      ),
    ).toBeNull();
  });
});
