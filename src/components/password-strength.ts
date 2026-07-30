/**
 * Pure password-policy + strength logic (unit-testable, no React).
 *
 * Validity mirrors the backend regex `^(?=.*[A-Za-z])(?=.*\d).*$` plus a
 * minimum length of 8: at least one letter AND one digit.
 */

/** Backend policy: min 8 chars, at least one letter and one digit. */
export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

/**
 * Heuristic strength score → level. Considers length and character-class
 * diversity. This is UX-only; validity is enforced by isPasswordValid.
 */
export function scorePassword(password: string): {
  score: number;
  level: StrengthLevel;
} {
  if (!password) return { score: 0, level: 'empty' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  let level: StrengthLevel;
  if (score <= 1) level = 'weak';
  else if (score === 2) level = 'fair';
  else if (score === 3) level = 'good';
  else level = 'strong';

  return { score, level };
}
