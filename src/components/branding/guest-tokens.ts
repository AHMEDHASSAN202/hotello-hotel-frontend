import { GXP_NAVY, relativeLuminance } from '@/lib/contrast';

/**
 * Guest app design tokens — DELIBERATE DUPLICATION of
 * hotello-guest-frontend/tailwind.config.ts + src/app/globals.css
 * (Epic 18 spec note 3, recorded decision). guest-tokens.test.ts reads the
 * sibling repo from disk and fails on drift; update BOTH sides together.
 */
export const GUEST_TOKENS = {
  canvas: '#F6F5F2',
  card: '#FFFFFF',
  ink: '#1A1D21',
  inkSoft: '#5A6068',
  inkFaint: '#9AA1A9',
  line: '#ECEAE5',
  radiusCard: '1.25rem',
  shadowCard: '0 1px 2px rgb(26 29 33 / 0.04), 0 8px 24px rgb(26 29 33 / 0.06)',
} as const;

/** Mirror of the guest app's accentVars() — prefixed --gp- to avoid collisions. */
export function previewAccentVars(accent: string | null): Record<string, string> {
  const value = accent ?? GXP_NAVY;
  return {
    '--gp-accent': value,
    '--gp-accent-soft': `color-mix(in srgb, ${value} 8%, white)`,
    '--gp-accent-contrast': relativeLuminance(value) > 0.45 ? '#1A1D21' : '#FFFFFF',
  };
}

/** Sample branding for the locked upsell preview (18.3 AC1) — recorded decision: gradient, no binary asset. */
export const DEMO_BRANDING = {
  accent: '#0F6B5C',
  welcome: {
    en: 'Welcome to the heart of Hurghada',
    ar: 'أهلاً بكم في قلب الغردقة',
  },
} as const;
