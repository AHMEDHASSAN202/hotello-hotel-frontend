import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { StaySettleResponse } from '@/lib/types';

/**
 * Task F2d, Part 2 — Story 22.4 AC3. `SettleAction` is a NEW, standalone
 * component (see the task brief's ruling) — it does not reuse or touch
 * `stay-detail-modal.tsx`'s settle logic, only the same backend endpoint.
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

import { SettleAction } from './settle-action';

function renderAction(props: Partial<Parameters<typeof SettleAction>[0]> = {}) {
  const onSettled = props.onSettled ?? vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <SettleAction
        stayId="s1"
        amount={250}
        currency="EGP"
        onSettled={onSettled}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onSettled };
}

beforeEach(() => {
  apiMock.api.mockReset();
});

describe('SettleAction (22.4 AC3)', () => {
  it('clicking settle opens the confirm modal with the formatted amount', () => {
    renderAction();
    fireEvent.click(screen.getByRole('button', { name: en.analytics.balances.settle }));
    expect(screen.getByText(en.analytics.balances.confirmTitle)).toBeTruthy();
    expect(screen.getByText('EGP 250.00', { exact: false })).toBeTruthy();
  });

  // Task F7 — settling is irreversible, so the confirmation body uses the
  // shared ConsequenceNote (danger tone), not a plain <p>, matching how the
  // stay checkout confirmation is styled elsewhere.
  it('22.4 AC3 (Task F7) — the confirm body renders inside a danger-toned ConsequenceNote', () => {
    renderAction();
    fireEvent.click(screen.getByRole('button', { name: en.analytics.balances.settle }));
    const body = screen.getByText('EGP 250.00', { exact: false });
    expect(body.className).toMatch(/border-danger/);
  });

  it('confirming calls POST /tenant/stays/{stayId}/settle, then onSettled and closes the modal', async () => {
    const result: StaySettleResponse = { settled: 250, unsettledTotal: 0 };
    apiMock.api.mockResolvedValueOnce(result);
    const { onSettled } = renderAction();

    fireEvent.click(screen.getByRole('button', { name: en.analytics.balances.settle }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: en.analytics.balances.confirm }),
    );

    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(result));
    expect(apiMock.api).toHaveBeenCalledWith('/tenant/stays/s1/settle', { method: 'POST' });
    expect(screen.queryByText(en.analytics.balances.confirmTitle)).toBeNull();
  });

  it('a failed settle shows the error inline and keeps the modal open', async () => {
    apiMock.api.mockRejectedValueOnce(new Error('boom'));
    const { onSettled } = renderAction();

    fireEvent.click(screen.getByRole('button', { name: en.analytics.balances.settle }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: en.analytics.balances.confirm }),
    );

    expect(await screen.findByText(en.analytics.balances.settleError)).toBeTruthy();
    expect(screen.getByText(en.analytics.balances.confirmTitle)).toBeTruthy();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('the disabled prop disables the trigger button', () => {
    renderAction({ disabled: true });
    expect(
      screen.getByRole('button', { name: en.analytics.balances.settle }).hasAttribute('disabled'),
    ).toBe(true);
  });
});
