import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/**
 * Epic 11, Story 11.5 — regression test for the stale-response race found in
 * code review (Task 16 fix round 1): `rooms/page.tsx` sets `qrRoom` straight
 * from each row's icon, so the modal can swap target rooms without ever
 * closing. If room A's requests are still in flight when the user opens room
 * B's QR, A's later-arriving response must NOT overwrite B's state.
 */

const apiMock = vi.hoisted(() => ({ api: vi.fn(), apiBlob: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  apiBlob: apiMock.apiBlob,
  saveBlob: vi.fn(),
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

import { RoomQrModal } from './room-qr-modal';
import type { Room } from '@/lib/types';

const ROOM_TYPE = { id: 't1', nameEn: 'Standard', nameAr: 'قياسية' };

const ROOM_A: Room = {
  id: 'room-a',
  roomNumber: '101',
  floor: 1,
  status: 'active',
  roomType: ROOM_TYPE,
};
const ROOM_B: Room = {
  id: 'room-b',
  roomNumber: '202',
  floor: 2,
  status: 'active',
  roomType: ROOM_TYPE,
};

/** A promise plus its resolver, so the test controls exactly when each of
 * room A's / room B's requests "arrives" — the whole point being to resolve
 * them out of request order. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function tree(room: Room | null, onClose = vi.fn()) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <RoomQrModal room={room} onClose={onClose} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  apiMock.api.mockReset();
  apiMock.apiBlob.mockReset();
  // jsdom has no createObjectURL/revokeObjectURL implementation.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

describe('RoomQrModal (11.5)', () => {
  it('AC3/AC4 — a slower first room never overwrites a faster second room\'s state (stale-response guard)', async () => {
    const detailA = deferred<{ guestUrl: string }>();
    const detailB = deferred<{ guestUrl: string }>();
    const qrA = deferred<{ blob: Blob; filename: string | null }>();
    const qrB = deferred<{ blob: Blob; filename: string | null }>();

    apiMock.api.mockImplementation((path: string) => {
      if (path === '/tenant/rooms/room-a') return detailA.promise;
      if (path === '/tenant/rooms/room-b') return detailB.promise;
      throw new Error(`unexpected api() call: ${path}`);
    });
    apiMock.apiBlob.mockImplementation((path: string) => {
      if (path.startsWith('/tenant/rooms/room-a/qr')) return qrA.promise;
      if (path.startsWith('/tenant/rooms/room-b/qr')) return qrB.promise;
      throw new Error(`unexpected apiBlob() call: ${path}`);
    });

    // Open room A's QR — its detail + QR requests are now in flight.
    const { rerender } = render(tree(ROOM_A));
    expect(apiMock.api).toHaveBeenCalledWith('/tenant/rooms/room-a');

    // Before A's requests resolve, the user clicks room B's QR icon instead —
    // the modal swaps target without ever closing (qrRoom just changes).
    rerender(tree(ROOM_B));
    expect(apiMock.api).toHaveBeenCalledWith('/tenant/rooms/room-b');

    // B's requests land FIRST (the realistic case: A's were already in
    // flight longer, but network timing is never guaranteed either way).
    detailB.resolve({
      guestUrl: 'https://guest.gxp.example/demo-hotel?room=202',
    });
    qrB.resolve({ blob: new Blob(['b']), filename: 'room-202.png' });
    await screen.findByText('https://guest.gxp.example/demo-hotel?room=202');
    expect(
      screen.getByText('QR code — Room 202', { selector: 'h2' }),
    ).toBeTruthy();

    // A's stale requests resolve AFTER B's — they must be discarded, not
    // overwrite the now-current room B state.
    detailA.resolve({
      guestUrl: 'https://guest.gxp.example/demo-hotel?room=101',
    });
    qrA.resolve({ blob: new Blob(['a']), filename: 'room-101.png' });

    // Give the (discarded) microtasks a tick to settle, then assert room B's
    // state is still what's rendered — room A's guest URL never appears.
    await waitFor(() => {
      expect(
        screen.getByText('https://guest.gxp.example/demo-hotel?room=202'),
      ).toBeTruthy();
    });
    expect(
      screen.queryByText('https://guest.gxp.example/demo-hotel?room=101'),
    ).toBeNull();
    expect(
      screen.getByText('QR code — Room 202', { selector: 'h2' }),
    ).toBeTruthy();
  });
});
