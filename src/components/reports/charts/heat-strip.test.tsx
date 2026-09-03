import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeatStrip } from './heat-strip';

const hours = Array.from({ length: 24 }, (_, h) => (h === 14 ? 9 : h % 3));

describe('HeatStrip', () => {
  it('renders with fixture data without throwing (dir="ltr")', () => {
    expect(() =>
      render(
        <div dir="ltr">
          <HeatStrip hours={hours} label="Busiest hours" />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders with fixture data without throwing (dir="rtl")', () => {
    expect(() =>
      render(
        <div dir="rtl">
          <HeatStrip hours={hours} label="أكثر الساعات ازدحامًا" />
        </div>,
      ),
    ).not.toThrow();
  });

  it('renders exactly 24 bar elements', () => {
    const { container } = render(<HeatStrip hours={hours} label="Busiest hours" />);
    const bars = container.querySelectorAll('[title]');
    expect(bars.length).toBe(24);
  });

  it('the title attribute shows the right hour/count pairing for at least one bucket', () => {
    const { container } = render(<HeatStrip hours={hours} label="Busiest hours" />);
    const bars = container.querySelectorAll('[title]');
    expect(bars[14].getAttribute('title')).toBe('14:00 — 9');
  });

  it('Task F5 — the aria-label comes from the caller-supplied `label` prop, never hardcoded English', () => {
    const { getByRole } = render(<HeatStrip hours={hours} label="أكثر الساعات ازدحامًا" />);
    expect(getByRole('img').getAttribute('aria-label')).toBe('أكثر الساعات ازدحامًا');
  });
});
