import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';

/**
 * Epic 12 — guidance kit behavior (spec note 7): InfoTip touch accessibility,
 * HintCard dismissal persistence, ConfirmModal destructive-styling discipline,
 * required-field marking, and the setup-steps block.
 */

const tenant = vi.hoisted(() => ({
  me: null as unknown,
  hasPermission: vi.fn(() => true),
  readOnly: false,
  isHintDismissed: vi.fn(() => false),
  dismissHint: vi.fn(),
}));

vi.mock('@/components/tenant-provider', () => ({
  useTenant: () => tenant,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
}));

import { ConfirmModal, ConsequenceNote, HintCard, InfoTip } from './guidance';
import { SetupSteps } from './setup-steps';
import { Field } from './ui';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  tenant.me = null;
  tenant.hasPermission.mockReset();
  tenant.hasPermission.mockReturnValue(true);
  tenant.isHintDismissed.mockReset();
  tenant.isHintDismissed.mockReturnValue(false);
  tenant.dismissHint.mockReset();
});

describe('InfoTip (12.1)', () => {
  it('AC2 — content opens on tap, not hover-only, from a real button', () => {
    wrap(<InfoTip>deep context</InfoTip>);
    const trigger = screen.getByRole('button', { name: 'More info' });
    expect(trigger.tagName).toBe('BUTTON'); // keyboard-focusable by nature
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip').textContent).toBe('deep context');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(trigger); // tap again closes
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('AC2 — closes on outside tap', () => {
    wrap(<InfoTip>deep context</InfoTip>);
    fireEvent.click(screen.getByRole('button', { name: 'More info' }));
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('AC2 — closes on Escape', () => {
    wrap(<InfoTip>deep context</InfoTip>);
    fireEvent.click(screen.getByRole('button', { name: 'More info' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('HintCard (12.4)', () => {
  it('AC2 — renders until dismissed, then persists the dismissal', () => {
    wrap(
      <HintCard hintKey="staff.firstRun" title="Two ways">
        body
      </HintCard>,
    );
    expect(screen.getByText('Two ways')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(tenant.dismissHint).toHaveBeenCalledWith('staff.firstRun');
  });

  it('AC2 — stays hidden for a user who already dismissed it', () => {
    tenant.isHintDismissed.mockReturnValue(true);
    wrap(
      <HintCard hintKey="staff.firstRun" title="Two ways">
        body
      </HintCard>,
    );
    expect(screen.queryByText('Two ways')).toBeNull();
  });
});

describe('ConfirmModal (12.5)', () => {
  const base = {
    open: true,
    onClose: vi.fn(),
    title: 'Disable?',
    confirmLabel: 'Disable',
    onConfirm: vi.fn(),
  };

  it('AC3 — reversible actions do not wear destructive styling', () => {
    wrap(
      <ConfirmModal {...base}>
        <ConsequenceNote>reversible</ConsequenceNote>
      </ConfirmModal>,
    );
    const confirm = screen.getByRole('button', { name: 'Disable' });
    expect(confirm.className).toContain('bg-ink');
    expect(confirm.className).not.toContain('bg-danger');
  });

  it('AC3 — destructive flag drives the red button', () => {
    wrap(
      <ConfirmModal {...base} destructive>
        <ConsequenceNote tone="danger">permanent</ConsequenceNote>
      </ConfirmModal>,
    );
    expect(
      screen.getByRole('button', { name: 'Disable' }).className,
    ).toContain('bg-danger');
  });

  it('AC1 — wires cancel/confirm and shows inline errors', () => {
    wrap(
      <ConfirmModal {...base} error="Something failed">
        <ConsequenceNote>note</ConsequenceNote>
      </ConfirmModal>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Something failed');
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    expect(base.onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(base.onClose).toHaveBeenCalled();
  });
});

describe('Field required marker (12.2 AC2)', () => {
  it('marks required fields and leaves optional ones unmarked', () => {
    wrap(
      <>
        <Field label="Name" required onChange={() => {}} value="" />
        <Field label="Notes" onChange={() => {}} value="" />
      </>,
    );
    expect(screen.getByText('Name').parentElement?.textContent).toContain('*');
    expect(screen.getByText('Notes').parentElement?.textContent).not.toContain(
      '*',
    );
  });
});

describe('SetupSteps (12.4 AC3)', () => {
  const meWith = (setup: {
    staffAdded: boolean;
    roleCreated: boolean;
    roomsAdded: boolean;
    qrGenerated: boolean;
    complete: boolean;
  }) => ({ setup });

  const allSteps = {
    staffAdded: true,
    roleCreated: true,
    roomsAdded: true,
    qrGenerated: true,
    complete: true,
  };

  it('renders derivable steps with auto-checked completion', () => {
    tenant.me = meWith({
      staffAdded: true,
      roleCreated: false,
      roomsAdded: true,
      qrGenerated: true,
      complete: false,
    });
    wrap(<SetupSteps />);
    expect(screen.getByText('Add your first staff member')).toBeTruthy();
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0); // staff/rooms/qr steps checked off
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(
      '/t/sunrise/roles',
    );
  });

  it('hides entirely when every step is complete', () => {
    tenant.me = meWith(allSteps);
    wrap(<SetupSteps />);
    expect(screen.queryByText('Get your dashboard ready')).toBeNull();
  });

  it('hides when dismissed, and dismissal persists via the hint key', () => {
    tenant.me = meWith({ ...allSteps, staffAdded: false, roleCreated: false, complete: false });
    wrap(<SetupSteps />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(tenant.dismissHint).toHaveBeenCalledWith('home.setupSteps');
  });

  it('AC1 — shows no dead-end steps the user lacks permission for', () => {
    tenant.me = meWith({ ...allSteps, staffAdded: false, roleCreated: false, complete: false });
    tenant.hasPermission.mockReturnValue(false);
    wrap(<SetupSteps />);
    expect(screen.queryByText('Get your dashboard ready')).toBeNull();
  });

  it('Epic 11 — the addRooms step renders unchecked with roomsAdded false, linking to the rooms page', () => {
    tenant.me = meWith({ ...allSteps, roomsAdded: false, complete: false });
    wrap(<SetupSteps />);
    expect(screen.getByText('Add your rooms')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open' }).getAttribute('href'),
    ).toBe('/t/sunrise/rooms');
  });

  it('Epic 11 — the addRooms step is hidden without rooms.create permission', () => {
    tenant.me = meWith({ ...allSteps, roomsAdded: false, qrGenerated: false, complete: false });
    tenant.hasPermission.mockImplementation((p: string) => p !== 'rooms.create');
    wrap(<SetupSteps />);
    expect(screen.queryByText('Add your rooms')).toBeNull();
    // printQr only needs rooms.read, which is still granted.
    expect(screen.getByText('Print your room QR codes')).toBeTruthy();
  });

  it('Epic 11 — the printQr step renders unchecked with qrGenerated false, linking to the QR page', () => {
    tenant.me = meWith({ ...allSteps, qrGenerated: false, complete: false });
    wrap(<SetupSteps />);
    expect(screen.getByText('Print your room QR codes')).toBeTruthy();
    expect(
      screen.getAllByRole('link', { name: 'Open' }).at(-1)?.getAttribute('href'),
    ).toBe('/t/sunrise/rooms/qr');
  });
});
