import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en';
import { DeltaChip } from './delta-chip';

/** Task F1b, Part 3 — Story 22.1 AC6: renders nothing when deltaPct is absent. */
function renderChip(props: Parameters<typeof DeltaChip>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DeltaChip {...props} />
    </NextIntlClientProvider>,
  );
}

describe('DeltaChip', () => {
  it('deltaPct undefined → renders nothing', () => {
    const { container } = renderChip({});
    expect(container.firstChild).toBeNull();
  });

  it('positive delta → up icon, success color, absolute value', () => {
    renderChip({ deltaPct: 12 });
    const value = screen.getByText('12%');
    expect(value.parentElement?.className).toContain('text-success');
  });

  it('negative delta → down icon, danger color, absolute value shown', () => {
    renderChip({ deltaPct: -7 });
    const value = screen.getByText('7%');
    expect(value.parentElement?.className).toContain('text-danger');
  });

  it('zero delta → neutral color', () => {
    renderChip({ deltaPct: 0 });
    const value = screen.getByText('0%');
    expect(value.parentElement?.className).toContain('text-ink-soft');
  });

  it('labelKey defaults to vsPrevious', () => {
    renderChip({ deltaPct: 5 });
    expect(screen.getByText('vs previous period')).toBeTruthy();
  });

  it('labelKey="vsYesterday" selects the right translated text', () => {
    renderChip({ deltaPct: 5, labelKey: 'vsYesterday' });
    expect(screen.getByText('vs same time yesterday')).toBeTruthy();
  });
});
