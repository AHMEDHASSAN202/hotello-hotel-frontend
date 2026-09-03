import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { mockResponsiveContainerSize } from './test-support';
import { SplitDonut } from './split-donut';

beforeAll(() => mockResponsiveContainerSize());

const segments = [
  { label: 'Cash', value: 40, color: '#0E2A47' },
  { label: 'Room charge', value: 60, color: '#C8A24A' },
];

describe('SplitDonut', () => {
  it('renders with fixture data without throwing (dir="ltr")', () => {
    expect(() =>
      render(
        <div dir="ltr">
          <SplitDonut segments={segments} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders with fixture data without throwing (dir="rtl")', () => {
    expect(() =>
      render(
        <div dir="rtl">
          <SplitDonut segments={segments} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders one segment per entry in `segments`', () => {
    const { container } = render(<SplitDonut segments={segments} />);
    expect(container.querySelectorAll('.recharts-pie-sector').length).toBe(segments.length);
  });
});
