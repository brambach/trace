import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/AppHeader';
import { DemoBar } from '@/components/DemoBar';
import { isDemo } from '@/lib/mode';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display' });
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: 'Trace', template: '%s · Trace' },
  description: 'Trace reads your Claude Code and Codex sessions, marks every time you corrected the agent, and writes the fix into CLAUDE.md so you stop repeating yourself.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ebe7de' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0d0c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-ground font-sans text-[15px] leading-[1.5] text-ink">
        <div className="mx-auto max-w-[980px] sm:px-6 sm:py-8">
          <div className="min-h-screen overflow-clip bg-paper shadow-lift sm:min-h-0 sm:rounded-[14px]">
            {isDemo && <DemoBar />}
            <AppHeader />
            <main className="px-5 pb-16 pt-8 sm:px-14 sm:pb-20 sm:pt-12">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
