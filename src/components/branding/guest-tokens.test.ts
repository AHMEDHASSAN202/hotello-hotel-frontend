import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUEST_TOKENS, previewAccentVars } from './guest-tokens';

describe('guest design tokens (18.1 AC2, spec note 3 — deliberate duplication + sync test)', () => {
  it('accent vars mirror the guest accentVars contract', () => {
    expect(previewAccentVars('#0F6B5C')).toEqual({
      '--gp-accent': '#0F6B5C',
      '--gp-accent-soft': 'color-mix(in srgb, #0F6B5C 8%, white)',
      '--gp-accent-contrast': '#FFFFFF',
    });
    // null → GXP default navy
    expect(previewAccentVars(null)['--gp-accent']).toBe('#0E2A47');
    // empty string → GXP default navy (empty is falsy, not just null)
    expect(previewAccentVars('')['--gp-accent']).toBe('#0E2A47');
  });

  // Sync test: reads the sibling guest repo when present (local workspace),
  // self-skips in CI where the sibling is not checked out.
  const guestRoot = path.resolve(__dirname, '../../../../hotello-guest-frontend');
  const itLocal = existsSync(guestRoot) ? it : it.skip;

  itLocal('token values match the guest app tailwind config', () => {
    const tw = readFileSync(path.join(guestRoot, 'tailwind.config.ts'), 'utf8');
    expect(tw).toContain(GUEST_TOKENS.canvas);
    expect(tw).toContain(GUEST_TOKENS.card);
    expect(tw).toContain(GUEST_TOKENS.ink);
    expect(tw).toContain(GUEST_TOKENS.inkSoft);
    expect(tw).toContain(GUEST_TOKENS.inkFaint);
    expect(tw).toContain(GUEST_TOKENS.line);
    expect(tw).toContain(GUEST_TOKENS.radiusCard);
    expect(tw).toContain(GUEST_TOKENS.shadowCard);
  });

  itLocal('default accent matches the guest globals.css', () => {
    const css = readFileSync(path.join(guestRoot, 'src/app/globals.css'), 'utf8');
    expect(css.toLowerCase()).toContain('--accent: #0e2a47');
  });
});
