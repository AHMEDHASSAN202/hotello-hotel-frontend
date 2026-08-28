import { describe, expect, it } from 'vitest';
import { audienceSummary, type AudienceTranslator } from './audience-summary';

/** Stub translator: readable output, interpolations inlined. */
const t: AudienceTranslator = (key, values) => {
  const map: Record<string, string> = {
    'audience.everyone': 'All current guests',
    'audience.guest': 'One specific guest',
    'stayTypes.all_inclusive': 'All-Inclusive',
    'stayTypes.half_board': 'Half Board',
  };
  if (key === 'audience.floorLabel') return `Floor ${values?.floor}`;
  if (key === 'audience.roomsCount') return `${values?.count} rooms`;
  return map[key] ?? key;
};

describe('audienceSummary (19.3 AC1)', () => {
  it('empty filter reads as everyone', () => {
    expect(audienceSummary({}, t)).toBe('All current guests');
    expect(audienceSummary(null, t)).toBe('All current guests');
  });

  it('combines stay types and floors with middots', () => {
    expect(
      audienceSummary({ stayTypes: ['all_inclusive'], floors: [3, 2] }, t),
    ).toBe('All-Inclusive · Floor 2 · Floor 3');
  });

  it('summarizes room pickers as a count', () => {
    expect(audienceSummary({ roomIds: ['a', 'b', 'c'] }, t)).toBe('3 rooms');
  });

  it('single guest shows the resolved label, falling back to the generic', () => {
    expect(audienceSummary({ stayId: 's1' }, t, 'Ivan — Room 301')).toBe(
      'Ivan — Room 301',
    );
    expect(audienceSummary({ stayId: 's1' }, t)).toBe('One specific guest');
  });
});
