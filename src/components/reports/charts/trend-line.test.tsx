import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { mockResponsiveContainerSize } from './test-support';
import { TrendLine } from './trend-line';

beforeAll(() => mockResponsiveContainerSize());

/**
 * Task F1b, Part 6 — RTL verification is a real requirement here, not a
 * formality: each chart renders inside both dir="ltr" and dir="rtl"
 * wrappers so a crash under RTL (Recharts internals assuming LTR pixel
 * math) would be caught even through jsdom's limited lens.
 */
const data = [
  { day: 'Mon', occ: 40, rev: 1200 },
  { day: 'Tue', occ: 55, rev: 1500 },
  { day: 'Wed', occ: 60, rev: 1800 },
];
const lines = [
  { key: 'occ', label: 'Occupancy', color: '#0E2A47' },
  { key: 'rev', label: 'Revenue', color: '#C8A24A' },
];

describe('TrendLine', () => {
  it('renders with fixture data without throwing (dir="ltr")', () => {
    expect(() =>
      render(
        <div dir="ltr">
          <TrendLine data={data} xKey="day" lines={lines} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders with fixture data without throwing (dir="rtl")', () => {
    expect(() =>
      render(
        <div dir="rtl">
          <TrendLine data={data} xKey="day" lines={lines} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders one series element per entry in `lines`', () => {
    const { container } = render(<TrendLine data={data} xKey="day" lines={lines} />);
    expect(container.querySelectorAll('.recharts-line').length).toBe(lines.length);
  });
});
