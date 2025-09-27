'use client';
import React, { useState } from "react";
import {
  SuiClientProvider,
  WalletProvider,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@mysten/dapp-kit/dist/index.css";
import { networkConfig } from "./networkConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useZkLogin } from "./contexts/ZkLoginContext";
import { CreatePoll } from "./components/CreatePoll";
import { Polls } from "./components/Polls";
import { UserProfile } from "./components/UserProfile";
import { Transaction } from "@mysten/sui/transactions";

const queryClient = new QueryClient();

function AppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="devnet">
        <WalletProvider>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

function App() {
  const currentAccount = useCurrentAccount();
  const { 
    account: zkLoginAccount, 
    logout: zkLogout,
    executeTransaction: executeZkLoginTx,
    isPending: isZkLoginTxPending,
  } = useZkLogin();
  const [pollsRefreshTrigger, setPollsRefreshTrigger] = useState(0);
  const {
    mutate: signAndExecute,
    isPending: isWalletTxPending,
  } = useSignAndExecuteTransaction();

  const account = currentAccount || (zkLoginAccount ? {
    address: zkLoginAccount.userAddr,
  } : null);

  const handleLogout = () => {
    if (zkLoginAccount) {
      zkLogout();
    }
  };

  const execute = async (
    transaction: Transaction,
    options?: { onSuccess: (result: any) => void }
  ) => {
    const { onSuccess } = options || {};
    if (zkLoginAccount) {
      const result = await executeZkLoginTx(transaction);
      onSuccess?.(result);
    } else {
      signAndExecute({ transaction }, { onSuccess: onSuccess || (() => {}) });
    }
  };

  const isPending = isZkLoginTxPending || isWalletTxPending;

  return (
    <div className="min-h-screen w-full">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              🗳️ DeVote
            </h1>
            {account && zkLoginAccount && (
              <div className="flex items-center gap-3">
                <div className="text-black">
                  <UserProfile account={zkLoginAccount} />
                </div>
                <Button onClick={handleLogout} variant="outline" className="text-black border-black hover:bg-black hover:text-white">
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-black min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {account ? (
            <div className="space-y-8">
            <div className="flex gap-4">
              <CreatePoll execute={execute} isPending={isPending} onCreated={() => {
                setPollsRefreshTrigger(prev => prev + 1);
                console.log("Poll created, refreshing polls list...");
              }} />
            </div>

            <div className="mt-8">
              <Polls
                execute={execute}
                isPending={isPending}
                walletAddress={account?.address}
                zkLoginAccountAddress={zkLoginAccount?.userAddr}
                refreshTrigger={pollsRefreshTrigger}
              />
            </div>
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="text-6xl mb-4">🗳️</div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Welcome to DeVote
                    </h2>
                    <p className="text-gray-600">
                      Connect your wallet or use zkLogin to create and participate in dynamic polls
                    </p>
                    <div className="pt-4">
                      <Link href="/zklogin">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                          🚀 Login with zkLogin
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AppWithProviders;
