import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MODULE_PAGES, isModuleBuilt } from './modules';

/**
 * Every plan module the sidebar can show must have a route — built modules a
 * real page, unbuilt ones the ComingSoon placeholder — so no nav entry or
 * direct URL ever 404s. Flipping `built` without shipping the real page (or
 * leaving the placeholder behind after shipping it) fails here.
 */

function pagePath(segment: string): string {
  return fileURLToPath(
    new URL(`../app/t/[slug]/(dashboard)/${segment}/page.tsx`, import.meta.url),
  );
}

describe('MODULE_PAGES route consistency', () => {
  it.each(Object.entries(MODULE_PAGES))(
    '%s has a page at its segment',
    (_key, def) => {
      expect(existsSync(pagePath(def.segment))).toBe(true);
    },
  );

  it.each(
    Object.entries(MODULE_PAGES).filter(([, def]) => !def.built),
  )('unbuilt module %s renders the ComingSoon placeholder', (_key, def) => {
    const source = readFileSync(pagePath(def.segment), 'utf8');
    expect(source).toContain('ComingSoon');
  });

  it.each(
    Object.entries(MODULE_PAGES).filter(([, def]) => def.built),
  )('built module %s does not render the ComingSoon placeholder', (_key, def) => {
    const source = readFileSync(pagePath(def.segment), 'utf8');
    expect(source).not.toContain('ComingSoon');
  });

  it('isModuleBuilt reads the flag from MODULE_PAGES', () => {
    expect(isModuleBuilt('requests')).toBe(MODULE_PAGES.requests.built);
    expect(isModuleBuilt('transportation')).toBe(
      MODULE_PAGES.transportation.built,
    );
  });
});
