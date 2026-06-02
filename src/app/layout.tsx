import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BetterCal - Simple Scheduling',
  description: 'A lean, fast scheduling app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 font-sans">
        <div className="min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
