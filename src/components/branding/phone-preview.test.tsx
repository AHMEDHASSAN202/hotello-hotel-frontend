import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhonePreview } from './phone-preview';

describe('PhonePreview (18.1 AC2)', () => {
  const base = {
    accent: '#0F6B5C',
    coverUrl: null as string | null,
    welcome: { en: 'Welcome to the heart of Hurghada', ar: 'أهلاً بكم في قلب الغردقة' },
    previewLocale: 'en' as const,
    hotelName: 'Sunrise Resort',
    logoUrl: null as string | null,
  };

  it('renders greeting, stay card, tiles, and the welcome line', () => {
    render(<PhonePreview {...base} />);
    expect(screen.getByTestId('preview-greeting')).toBeTruthy();
    expect(screen.getByTestId('preview-stay-card')).toBeTruthy();
    expect(screen.getByText('Welcome to the heart of Hurghada')).toBeTruthy();
  });

  it('applies the accent through CSS custom properties', () => {
    render(<PhonePreview {...base} />);
    const frame = screen.getByTestId('phone-preview');
    expect(frame.getAttribute('style')).toContain('#0F6B5C');
  });

  it('renders RTL with Arabic strings when previewLocale is ar', () => {
    render(<PhonePreview {...base} previewLocale="ar" />);
    const frame = screen.getByTestId('phone-preview');
    expect(frame.getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('أهلاً بكم في قلب الغردقة')).toBeTruthy();
  });

  it('shows the cover with scrim when set, clean header otherwise (18.2 AC3 parity)', () => {
    const { rerender } = render(<PhonePreview {...base} />);
    expect(screen.queryByTestId('preview-cover')).toBeNull();
    rerender(<PhonePreview {...base} coverUrl="http://api/files/branding/x-thumb.webp" />);
    expect(screen.getByTestId('preview-cover')).toBeTruthy();
  });

  it('omits the welcome line when empty for the locale chain (no gap)', () => {
    render(<PhonePreview {...base} welcome={null} />);
    expect(screen.queryByTestId('preview-welcome')).toBeNull();
  });

  it('renders the stock gradient cover for the locked upsell (18.3 AC1) — no img', () => {
    render(<PhonePreview {...base} demoCover />);
    const cover = screen.getByTestId('preview-demo-cover');
    expect(cover.querySelector('img')).toBeNull();
    expect(cover.getAttribute('style')).toContain('gradient');
    // it occupies the real cover slot, so the clean header is gone
    expect(screen.queryByTestId('preview-cover')).toBeNull();
  });

  it('a real cover wins over the demo flag', () => {
    render(
      <PhonePreview
        {...base}
        demoCover
        coverUrl="http://api/files/branding/x-thumb.webp"
      />,
    );
    expect(screen.getByTestId('preview-cover')).toBeTruthy();
    expect(screen.queryByTestId('preview-demo-cover')).toBeNull();
  });
});
