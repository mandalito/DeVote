'use client';

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { networkConfig } from './networkConfig';
import { ZkLoginProvider } from "./contexts/ZkLoginContext";
import '@mysten/dapp-kit/dist/index.css';

const inter = Inter({ subsets: ['latin'] });
const queryClient = new QueryClient();

/*
export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Sui Vote',
  description: 'One-person-one-vote on Sui (wallet-less)',
};
*/

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
            <WalletProvider>
              <ZkLoginProvider>{children}</ZkLoginProvider>
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
