import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { mockResponsiveContainerSize } from './test-support';
import { BarsByDay } from './bars-by-day';

beforeAll(() => mockResponsiveContainerSize());

const data = [
  { day: 'Mon', orders: 10, events: 2 },
  { day: 'Tue', orders: 14, events: 3 },
];
const lines = [
  { key: 'orders', label: 'Orders', color: '#0E2A47' },
  { key: 'events', label: 'Events', color: '#2F7D4F' },
];

describe('BarsByDay', () => {
  it('renders with fixture data without throwing (dir="ltr")', () => {
    expect(() =>
      render(
        <div dir="ltr">
          <BarsByDay data={data} xKey="day" lines={lines} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders with fixture data without throwing (dir="rtl")', () => {
    expect(() =>
      render(
        <div dir="rtl">
          <BarsByDay data={data} xKey="day" lines={lines} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders one series element per entry in `lines`', () => {
    const { container } = render(<BarsByDay data={data} xKey="day" lines={lines} />);
    expect(container.querySelectorAll('.recharts-bar').length).toBe(lines.length);
  });
});
