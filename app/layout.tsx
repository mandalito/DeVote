import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import UserProfile from '@/components/UserProfile';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Sui Vote',
  description: 'One-person-one-vote on Sui (wallet-less)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-zinc-800">
          <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">{process.env.NEXT_PUBLIC_APP_NAME ?? 'Sui Vote'}</Link>
            <div className="flex items-center gap-6">
              <nav className="flex gap-4 text-sm text-zinc-300">
                <Link href="/">Polls</Link>
                <Link href="/admin">Admin</Link>
                <Link href="/demo">Demo</Link>
              </nav>
              <UserProfile />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
