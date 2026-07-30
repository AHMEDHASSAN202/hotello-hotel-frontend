import { describe, expect, it } from 'vitest';
import { grants } from './permissions';

describe('grants', () => {
  it('passes any key when the wildcard is present (the owner)', () => {
    expect(grants(['*'], 'staff.read')).toBe(true);
    expect(grants(['*'], 'anything.at.all')).toBe(true);
  });

  it('passes only the exact keys granted', () => {
    const perms = ['staff.read', 'staff.invite'];
    expect(grants(perms, 'staff.read')).toBe(true);
    expect(grants(perms, 'staff.invite')).toBe(true);
    expect(grants(perms, 'staff.disable')).toBe(false);
  });

  it('denies everything for an empty permission set', () => {
    expect(grants([], 'staff.read')).toBe(false);
  });
});
