import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiniBar } from './mini-bar';

const data = [
  { label: 'Cash', value: 40, color: '#0E2A47' },
  { label: 'Room charge', value: 60, color: '#C8A24A' },
];

describe('MiniBar', () => {
  it('renders with fixture data without throwing (dir="ltr")', () => {
    expect(() =>
      render(
        <div dir="ltr">
          <MiniBar data={data} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders with fixture data without throwing (dir="rtl")', () => {
    expect(() =>
      render(
        <div dir="rtl">
          <MiniBar data={data} />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders one row per entry in `data`', () => {
    render(<MiniBar data={data} />);
    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Room charge')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
  });
});
