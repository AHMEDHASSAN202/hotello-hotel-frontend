import type { ModuleKey } from './types';

/**
 * Single source of truth for which plan modules have a built dashboard page
 * (same philosophy as the guest app's tiles config). Unbuilt modules render a
 * non-clickable "Soon" nav entry and a ComingSoon route placeholder.
 * Activating a module later = flip `built` to true and replace its
 * placeholder page — `modules.test.ts` fails until both halves agree.
 */
export interface ModulePageDef {
  /** URL segment under /t/{slug}/ — matches the sidebar's nav item. */
  segment: string;
  built: boolean;
}

export const MODULE_PAGES: Record<ModuleKey, ModulePageDef> = {
  transportation: { segment: 'transportation', built: false },
  housekeeping: { segment: 'housekeeping', built: true },
  fnb: { segment: 'fnb', built: true },
  guest_app_branding: { segment: 'branding', built: true },
  analytics: { segment: 'analytics', built: true },
  requests: { segment: 'requests', built: true },
  hotel_info: { segment: 'hotel-info', built: true },
  announcements: { segment: 'announcements', built: true },
  events: { segment: 'events', built: true },
};

export function isModuleBuilt(key: ModuleKey): boolean {
  return MODULE_PAGES[key].built;
}
