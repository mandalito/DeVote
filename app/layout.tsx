import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import UserProfile from '@/components/UserProfile';
import { Inter } from "next/font/google";
import { ZkLoginProvider } from "./contexts/ZkLoginContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Sui Vote',
  description: 'One-person-one-vote on Sui (wallet-less)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ZkLoginProvider>{children}</ZkLoginProvider>
      </body>
    </html>
  );
}
