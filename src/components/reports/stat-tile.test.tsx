import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './stat-tile';

/**
 * Task F1b, Part 2 — StatTile extracted verbatim from the requests page's
 * stats-lite block. The `tone==='danger'` red-text rule only fires for a
 * numeric value greater than zero — a formatted string can't be meaningfully
 * compared to 0, so it must never turn red.
 */
describe('StatTile', () => {
  it('renders label, value and infoTip', () => {
    render(<StatTile label="Open now" value={4} infoTip={<span>tip</span>} />);
    expect(screen.getByText('Open now')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('tip')).toBeTruthy();
  });

  it('tone="danger" + numeric value > 0 → value text has text-danger', () => {
    render(<StatTile label="Overdue now" value={2} tone="danger" />);
    const value = screen.getByText('2');
    expect(value.className).toContain('text-danger');
  });

  it('tone="danger" + value === 0 → no text-danger', () => {
    render(<StatTile label="Overdue now" value={0} tone="danger" />);
    const value = screen.getByText('0');
    expect(value.className).not.toContain('text-danger');
    expect(value.className).toContain('text-ink');
  });

  it('tone="danger" + non-numeric value (formatted currency string) → never text-danger', () => {
    render(<StatTile label="Balance" value="EGP 0.00" tone="danger" />);
    const value = screen.getByText('EGP 0.00');
    expect(value.className).not.toContain('text-danger');
    expect(value.className).toContain('text-ink');
  });
});
