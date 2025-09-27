'use client'
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
import { Transaction } from "@mysten/sui/transactions";

const queryClient = new QueryClient();

function AppWithProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
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
  }

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
    <div className="container mx-auto p-6">
      <Card>
        <CardContent className="pt-6">
          {account ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Sui Voting Dapp</h1>
                {zkLoginAccount && <Button onClick={handleLogout}>Logout</Button>}
              </div>
              
              <CreatePoll execute={execute} isPending={isPending} onCreated={() => {
                // In a real app, you would refetch the list of polls here
                console.log("Poll created, refetching polls would happen here.");
              }} />
              <div className="mt-8">
                <Polls
                  execute={execute}
                  isPending={isPending}
                  walletAddress={account?.address}
                  zkLoginAccountAddress={zkLoginAccount?.address}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome to the Sui Voting Dapp
              </h2>
              <p className="text-gray-600">
                Please connect your wallet or{" "}
                <Link href="/zklogin" className="text-blue-500 underline">
                  log in with zkLogin
                </Link>
                {" "}to participate.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AppWithProviders;
