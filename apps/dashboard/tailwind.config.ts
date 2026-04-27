import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f6f3ec',
        ink: '#1a1a1a',
        dim: '#8a7e63',
        accent: '#c89b7b',
        rule: 'rgba(26, 26, 26, 0.18)',
        quiet: 'rgba(26, 26, 26, 0.06)',
        page: '#ddd6c7',
        good: '#4a7a3f',
        bad: '#a05a3f',
      },
      fontFamily: {
        serif: [
          'Iowan Old Style',
          'Apple Garamond',
          'Hoefler Text',
          'Georgia',
          'Times New Roman',
          'serif',
        ],
        mono: [
          'SF Mono',
          'IBM Plex Mono',
          'JetBrains Mono',
          'ui-monospace',
          'Menlo',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
