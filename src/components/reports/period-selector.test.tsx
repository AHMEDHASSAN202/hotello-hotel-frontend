import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { PeriodSelection } from '@/lib/use-period-selection';
import { PeriodSelector } from './period-selector';

/** Task F1b, Part 5 — the aria-pressed pill-row idiom + custom date inputs. */
function renderSelector(value: PeriodSelection, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PeriodSelector value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe('PeriodSelector', () => {
  it('each preset button has the right aria-pressed state', () => {
    renderSelector({ preset: 'last7' });
    expect(screen.getByRole('button', { name: 'Last 7 days' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Yesterday' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Last 30 days' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Custom range' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a non-custom preset calls onChange with just {preset}', () => {
    const onChange = renderSelector({ preset: 'last7' });
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'today' });
  });

  it('date inputs are absent while a non-custom preset is selected', () => {
    renderSelector({ preset: 'last7' });
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.queryByLabelText('To')).toBeNull();
  });

  it('clicking custom calls onChange with preset:"custom", preserving any existing from/to', () => {
    const onChange = renderSelector({ preset: 'last7' });
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'custom', from: undefined, to: undefined });
  });

  it('clicking custom reveals the two date inputs (component is controlled by value.preset)', () => {
    renderSelector({ preset: 'custom' });
    expect(screen.getByLabelText('From')).toBeTruthy();
    expect(screen.getByLabelText('To')).toBeTruthy();
  });

  it('when value.preset is already custom, the date inputs render with the current values', () => {
    renderSelector({ preset: 'custom', from: '2026-01-01', to: '2026-01-05' });
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-01-01');
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-01-05');
  });

  it('typing in the from date input calls onChange with updated from, preserving to', () => {
    const onChange = renderSelector({ preset: 'custom', from: '2026-01-01', to: '2026-01-05' });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-10' } });
    expect(onChange).toHaveBeenCalledWith({ preset: 'custom', from: '2026-01-10', to: '2026-01-05' });
  });

  it('typing in the to date input calls onChange with updated to, preserving from', () => {
    const onChange = renderSelector({ preset: 'custom', from: '2026-01-01', to: '2026-01-05' });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-20' } });
    expect(onChange).toHaveBeenCalledWith({ preset: 'custom', from: '2026-01-01', to: '2026-01-20' });
  });
});
