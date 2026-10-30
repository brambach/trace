import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--${name})`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: v('ground'),
        paper: v('paper'),
        raised: v('raised'),
        sunk: v('sunk'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        muted: v('muted'),
        faint: v('faint'),
        line: v('line'),
        'line-strong': v('line-strong'),
        mark: v('mark'),
        'mark-wash': v('mark-wash'),
        held: v('held'),
        'held-wash': v('held-wash'),
        primary: v('primary'),
        'on-primary': v('on-primary'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        lift: v('lift'),
        float: v('float'),
      },
      transitionTimingFunction: {
        out: v('ease-out'),
        move: v('ease-move'),
      },
    },
  },
  plugins: [],
} satisfies Config;
