import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0E2A47',
          deep: '#0A1F36',
          soft: '#3D4B5F',
        },
        gold: {
          DEFAULT: '#C8A24A',
          soft: '#F3E9D2',
        },
        paper: '#F7F8FA',
        line: '#E3E8EF',
        danger: '#B3402A',
        success: '#2F7D4F',
      },
      fontFamily: {
        // Arabic-capable fallbacks last: Latin glyphs resolve from the first
        // family, Arabic glyphs fall through to the Arabic font.
        display: ['Sora', '"Cairo"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        'banner-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'banner-in': 'banner-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
