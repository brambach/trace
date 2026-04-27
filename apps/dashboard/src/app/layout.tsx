import './globals.css';

export const metadata = { title: 'Trace', description: 'A second brain for AI-assisted coding' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-page font-serif text-ink">{children}</body>
    </html>
  );
}
