import './globals.css';
import { AppHeader } from '@/components/AppHeader';

export const metadata = { title: 'Trace', description: 'A second brain for AI-assisted coding' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page font-serif text-ink">
        <div className="mx-auto max-w-[880px] px-6 py-8">
          <div className="overflow-hidden rounded-sm bg-paper shadow-[0_1px_1px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.18)]">
            <AppHeader active={null} />
            <div className="px-16 py-10">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
