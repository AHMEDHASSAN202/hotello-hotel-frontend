import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { AudienceFilter } from '@/lib/types';

const apiMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  api: apiMock,
  ApiError: class ApiError extends Error {},
}));

import { AudienceBuilder } from './audience-builder';

function stubApi() {
  apiMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/tenant/rooms')) {
      return {
        data: [
          { id: 'room-1', roomNumber: '201', floor: 2, status: 'active', roomType: { id: 't', nameEn: 'Std', nameAr: 'ق' } },
          { id: 'room-2', roomNumber: '301', floor: 3, status: 'active', roomType: { id: 't', nameEn: 'Std', nameAr: 'ق' } },
        ],
        total: 2,
        page: 1,
        pageSize: 200,
        usage: { used: 2, max: null },
      };
    }
    if (path.startsWith('/tenant/stays')) {
      return { data: [{ id: 'stay-9', guestName: 'Ivan Petrov', roomNumber: '301' }], total: 1 };
    }
    if (path === '/tenant/announcements/audience/preview') {
      return { count: 62 };
    }
    throw new Error(`unmocked path: ${path}`);
  });
}

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  apiMock.mockReset();
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const flush = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    // Let pending promises resolve inside act.
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('AudienceBuilder (19.1 AC2-AC4)', () => {
  it('defaults to everyone and shows the debounced live recipient count', async () => {
    wrap(<AudienceBuilder value={{}} onChange={vi.fn()} />);
    expect(screen.getByTestId('audience-live-count').textContent).toBe(
      en.announcements.audience.counting,
    );
    await flush(500);
    expect(apiMock).toHaveBeenCalledWith(
      '/tenant/announcements/audience/preview',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.getByTestId('audience-live-count').textContent).toContain('62');
    expect(screen.getByTestId('audience-live-count').textContent).toContain('currently');
  });

  it('filtered mode: checking a stay type emits the filter; dims combine', async () => {
    const onChange = vi.fn();
    wrap(<AudienceBuilder value={{}} onChange={onChange} />);
    await flush(500);
    fireEvent.click(screen.getByRole('radio', { name: en.announcements.audience.filtered }));
    expect(onChange).toHaveBeenCalledWith({});
    fireEvent.click(screen.getByLabelText(en.announcements.stayTypes.all_inclusive));
    expect(onChange).toHaveBeenLastCalledWith({ stayTypes: ['all_inclusive'] });
  });

  it('filtered mode: floors derive from the rooms list', async () => {
    const onChange = vi.fn();
    wrap(<AudienceBuilder value={{ stayTypes: ['all_inclusive'] }} onChange={onChange} />);
    await flush(500);
    fireEvent.click(screen.getByLabelText('Floor 2'));
    expect(onChange).toHaveBeenLastCalledWith({
      stayTypes: ['all_inclusive'],
      floors: [2],
    });
  });

  it('guest mode: search finds active stays and picking one emits stayId only', async () => {
    const onChange = vi.fn();
    wrap(<AudienceBuilder value={{}} onChange={onChange} />);
    await flush(500);
    fireEvent.click(screen.getByRole('radio', { name: en.announcements.audience.guest }));
    fireEvent.change(screen.getByLabelText(en.announcements.audience.guestSearch), {
      target: { value: 'Ivan' },
    });
    await flush(500);
    expect(apiMock).toHaveBeenCalledWith('/tenant/stays?view=active&search=Ivan');
    fireEvent.click(screen.getByText('Ivan Petrov — 301'));
    expect(onChange).toHaveBeenLastCalledWith({ stayId: 'stay-9' });
  });

  it('switching mode clears the previous filter', async () => {
    const onChange = vi.fn();
    wrap(<AudienceBuilder value={{ floors: [2] }} onChange={onChange} />);
    await flush(500);
    fireEvent.click(screen.getByRole('radio', { name: en.announcements.audience.everyone }));
    expect(onChange).toHaveBeenLastCalledWith({});
  });
});
