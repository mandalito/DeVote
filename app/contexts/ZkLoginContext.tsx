'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const accountDataKey = "zklogin-demo.accounts";

type AccountData = {
    provider: string;
    userAddr: string;
    zkProofs: any;
    ephemeralPrivateKey: string;
    userSalt: string;
    sub: string;
    aud: string;
    maxEpoch: number;
};

interface ZkLoginContextType {
  account: AccountData | null;
  login: (accountData: AccountData) => void;
  logout: () => void;
}

const ZkLoginContext = createContext<ZkLoginContextType | undefined>(undefined);

export const ZkLoginProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<AccountData | null>(null);

  useEffect(() => {
    const dataRaw = sessionStorage.getItem(accountDataKey);
    if (dataRaw) {
      const data: AccountData[] = JSON.parse(dataRaw);
      if (data.length > 0) {
        setAccount(data[0]);
      }
    }
  }, []);

  const login = (accountData: AccountData) => {
    setAccount(accountData);
    sessionStorage.setItem(accountDataKey, JSON.stringify([accountData]));
  };

  const logout = () => {
    setAccount(null);
    sessionStorage.removeItem(accountDataKey);
  };

  return (
    <ZkLoginContext.Provider value={{ account, login, logout }}>
      {children}
    </ZkLoginContext.Provider>
  );
};

export const useZkLogin = () => {
  const context = useContext(ZkLoginContext);
  if (context === undefined) {
    throw new Error('useZkLogin must be used within a ZkLoginProvider');
  }
  return context;
};
