import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/** Epic 13, Story 13.1 — the check-in form + one-time code screen. */

const tenant = vi.hoisted(() => ({
  me: { user: { id: 'u1' }, hotel: { defaultLanguage: 'ar' } },
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => true),
  dismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({
  useTenant: () => tenant,
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

import { ApiError } from '@/lib/api';
import { CheckInModal } from './check-in-modal';

const ROOMS = [
  { id: 'r-101', roomNumber: '101', floor: 1 },
  { id: 'r-102', roomNumber: '102', floor: 1 },
  { id: 'r-x', roomNumber: 'ANNEX', floor: null },
];

function renderModal(onCreated = vi.fn(), onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <CheckInModal open onClose={onClose} onCreated={onCreated} />
    </NextIntlClientProvider>,
  );
  return { onCreated, onClose };
}

beforeEach(() => {
  apiMock.api.mockReset();
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.includes('available-rooms')) return ROOMS;
    return {};
  });
});

describe('CheckInModal (13.1)', () => {
  it('AC1 — renders the form with guidance, floor-grouped available rooms, and the 7 languages', async () => {
    renderModal();

    expect(await screen.findByText('Floor 1')).toBeTruthy();
    expect(screen.getByText('No floor set')).toBeTruthy();
    // FieldHelp present (placeholder = example, hint = rule).
    expect(
      screen.getByText(
        "As you'd greet them — shown in the guest app and on their requests.",
      ),
    ).toBeTruthy();
    // Language defaults to the hotel default (ar) and lists all seven.
    const select = screen.getByDisplayValue('Arabic') as HTMLSelectElement;
    expect(select.options.length).toBe(7);
  });

  it('AC1 — the room picker is searchable and filters the available rooms', async () => {
    renderModal();
    await screen.findByText('Floor 1');

    fireEvent.change(screen.getByLabelText('Search available rooms'), {
      target: { value: 'ANNEX' },
    });
    expect(screen.queryByText('101')).toBeNull();
    expect(screen.getByText('ANNEX')).toBeTruthy();
  });

  it('AC3 — success shows the one-time code with copy + never-again wording', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.includes('available-rooms')) return ROOMS;
      return {
        stay: { id: 's1', guestName: 'Mona Adel', email: 'mona@example.com' },
        code: '482913',
      };
    });
    const { onCreated } = renderModal();
    await screen.findByText('Floor 1');

    fireEvent.change(screen.getByLabelText(/Guest name/), {
      target: { value: 'Mona Adel' },
    });
    fireEvent.click(screen.getByRole('button', { name: '101' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    expect(await screen.findByText('482913')).toBeTruthy();
    expect(screen.getByText('Mona Adel is checked in')).toBeTruthy();
    expect(
      screen.getByText(/this code won't be shown again/i),
    ).toBeTruthy();
    expect(
      screen.getByText("We've also emailed the code to mona@example.com."),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(onCreated).toHaveBeenCalled();

    // The POST body carried the required fields + hotel-default language.
    const postCall = apiMock.api.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )!;
    const body = JSON.parse(String((postCall[1] as RequestInit).body));
    expect(body).toMatchObject({
      guestName: 'Mona Adel',
      roomId: 'r-101',
      language: 'ar',
    });
    expect(body.checkOutDate > body.checkInDate).toBe(true);
  });

  it('AC2 — a ROOM_OCCUPIED race maps to a room field error and refreshes availability', async () => {
    let calls = 0;
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes('available-rooms')) {
        calls += 1;
        return ROOMS;
      }
      if (init?.method === 'POST') {
        throw new ApiError(409, 'occupied', undefined, 'ROOM_OCCUPIED');
      }
      return {};
    });
    renderModal();
    await screen.findByText('Floor 1');

    fireEvent.change(screen.getByLabelText(/Guest name/), {
      target: { value: 'Mona Adel' },
    });
    fireEvent.click(screen.getByRole('button', { name: '101' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    expect(
      await screen.findByText(
        'That room already has an active stay. Choose another room, or check the current guest out first.',
      ),
    ).toBeTruthy();
    await waitFor(() => expect(calls).toBe(2)); // availability refreshed
  });

  it('submit stays disabled until a guest name and room are chosen', async () => {
    renderModal();
    await screen.findByText('Floor 1');

    const submit = screen.getByRole('button', { name: 'Check in' });
    expect(submit.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText(/Guest name/), {
      target: { value: 'Mona' },
    });
    expect(submit.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '102' }));
    expect(submit.hasAttribute('disabled')).toBe(false);
  });
});
