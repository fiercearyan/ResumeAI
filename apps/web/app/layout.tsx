import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'ResumeAI',
  description: 'AI-powered resume scoring, optimization, and auto-apply',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
