import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import { BasisFootnote } from './basis-footnote';

/** Task F1b, Part 4 — one test per basis value. */
function renderFootnote(basis: Parameters<typeof BasisFootnote>[0]['basis']) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BasisFootnote basis={basis} />
    </NextIntlClientProvider>,
  );
}

describe('BasisFootnote', () => {
  it('delivered_only renders the right translated text', () => {
    renderFootnote('delivered_only');
    expect(screen.getByText('Delivered orders only')).toBeTruthy();
  });

  it('events_starting_in_period renders the right translated text', () => {
    renderFootnote('events_starting_in_period');
    expect(screen.getByText('Events starting in this period')).toBeTruthy();
  });

  it('delivered_booked renders the right translated text', () => {
    renderFootnote('delivered_booked');
    expect(screen.getByText('Delivered orders and booked events')).toBeTruthy();
  });
});
