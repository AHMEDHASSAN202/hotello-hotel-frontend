import { describe, expect, it } from 'vitest';
import {
  isPasswordValid,
  scorePassword,
  PASSWORD_MIN_LENGTH,
} from './password-strength';

describe('isPasswordValid (Story 8 password policy)', () => {
  it('rejects passwords shorter than the minimum length', () => {
    expect(isPasswordValid('Ab1')).toBe(false);
  });

  it('rejects passwords with no digit', () => {
    expect(isPasswordValid('abcdefgh')).toBe(false);
  });

  it('rejects passwords with no letter', () => {
    expect(isPasswordValid('12345678')).toBe(false);
  });

  it('accepts a password with a letter and a digit at min length', () => {
    expect('abcdefg1'.length).toBe(PASSWORD_MIN_LENGTH);
    expect(isPasswordValid('abcdefg1')).toBe(true);
  });
});

describe('scorePassword', () => {
  it('returns empty for an empty string', () => {
    expect(scorePassword('').level).toBe('empty');
  });

  it('rates a short simple password as weak', () => {
    expect(scorePassword('abc1').level).toBe('weak');
  });

  it('rates a long mixed password as strong', () => {
    expect(scorePassword('Abcdefgh123!').level).toBe('strong');
  });
});
