'use client';

/* eslint-disable @next/next/no-img-element */
import { Bell, ConciergeBell, Info, UtensilsCrossed } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { RequestTranslationMap } from '@/lib/types';
import { GUEST_TOKENS, previewAccentVars } from './guest-tokens';

/**
 * Static phone-frame mock of the guest home (18.1 AC2). Built from the real
 * guest tokens (guest-tokens.ts) so the preview is honest — layout and type
 * scale mirror gxp-guest-frontend/src/components/home-screen.tsx.
 * Not an iframe, no data fetching: pure render of the three knobs.
 */
const STRINGS = {
  en: {
    greeting: 'Good evening, Sarah',
    room: 'Room',
    stay: 'Your stay',
    checkout: 'Check-out Sun, 12:00',
    services: 'Hotel services',
    tiles: ['Requests', 'Dining', 'Housekeeping', 'Hotel info'],
  },
  ar: {
    greeting: 'مساء الخير، سارة',
    room: 'الغرفة',
    stay: 'إقامتك',
    checkout: 'المغادرة الأحد، 12:00',
    services: 'خدمات الفندق',
    tiles: ['الطلبات', 'المطعم', 'التدبير الفندقي', 'معلومات الفندق'],
  },
} as const;

const TILE_ICONS = [ConciergeBell, UtensilsCrossed, Bell, Info];

/**
 * Stock cover for the locked upsell preview (18.3 AC1). Recorded epic
 * decision: a crafted gradient, never a binary asset — it rides the accent
 * so the sample still reads as one designed system.
 */
const DEMO_COVER_GRADIENT =
  'linear-gradient(135deg, var(--gp-accent) 0%, #123A4F 55%, #C8A24A 145%)';

export function PhonePreview({
  accent,
  coverUrl,
  welcome,
  previewLocale,
  hotelName,
  logoUrl,
  demoCover = false,
}: {
  accent: string | null;
  coverUrl: string | null;
  welcome: RequestTranslationMap | null;
  previewLocale: 'en' | 'ar';
  hotelName: string;
  logoUrl: string | null;
  /** Fill the cover slot with the stock gradient when no photo is set (18.3). */
  demoCover?: boolean;
}) {
  const s = STRINGS[previewLocale];
  const vars = previewAccentVars(accent) as CSSProperties;
  const welcomeLine = welcome ? (welcome[previewLocale] ?? welcome.en ?? '') : '';
  const cardStyle: CSSProperties = {
    background: GUEST_TOKENS.card,
    borderRadius: GUEST_TOKENS.radiusCard,
    boxShadow: GUEST_TOKENS.shadowCard,
  };

  return (
    <div
      data-testid="phone-preview"
      dir={previewLocale === 'ar' ? 'rtl' : 'ltr'}
      style={{ ...vars, background: GUEST_TOKENS.canvas }}
      className="mx-auto w-[300px] overflow-hidden rounded-[2.2rem] border-[6px] border-ink-deep shadow-xl"
    >
      <div className="h-[560px] overflow-hidden text-[13px]" style={{ color: GUEST_TOKENS.ink }}>
        {coverUrl || demoCover ? (
          <div
            data-testid={coverUrl ? 'preview-cover' : 'preview-demo-cover'}
            className="relative aspect-[16/9] w-full"
            style={coverUrl ? undefined : { background: DEMO_COVER_GRADIENT }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pb-2.5">
              {logoUrl ? <img src={logoUrl} alt="" className="h-6 w-6 rounded-lg object-contain" /> : null}
              <span className="text-[12px] font-semibold text-white">{hotelName}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 pt-4">
            {logoUrl ? <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg object-contain" /> : null}
            <span className="text-[12px] font-semibold">{hotelName}</span>
          </div>
        )}

        <div className="px-4">
          <h4 data-testid="preview-greeting" className="mt-4 text-[16px] font-bold leading-snug">
            {s.greeting}
          </h4>
          {welcomeLine ? (
            <p data-testid="preview-welcome" className="mt-1 text-[11px]" style={{ color: GUEST_TOKENS.inkSoft }}>
              {welcomeLine}
            </p>
          ) : null}

          <div data-testid="preview-stay-card" className="mt-3 p-3.5" style={cardStyle}>
            <div
              className="text-[9px] font-medium uppercase tracking-[0.14em]"
              style={{ color: GUEST_TOKENS.inkFaint }}
            >
              {s.stay}
            </div>
            <div className="mt-1 text-[22px] font-bold tabular-nums">{s.room} 214</div>
            <div
              className="mt-2 rounded-lg p-2 text-[10px]"
              style={{ background: 'var(--gp-accent-soft)' }}
            >
              {s.checkout}
            </div>
          </div>

          <div className="mb-2 mt-4 text-[11px] font-semibold">{s.services}</div>
          <div className="grid grid-cols-2 gap-2 pb-4">
            {s.tiles.map((label, i) => {
              const Icon = TILE_ICONS[i];
              return (
                <div key={label} className="flex h-[72px] flex-col justify-between p-2.5" style={cardStyle}>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: 'var(--gp-accent-soft)', color: 'var(--gp-accent)' }}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="text-[10px] font-semibold">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
