'use client';

import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api';
import { useSetAtom } from 'jotai';
import { userAtom } from '@/lib/state';

export default function LoginButton({ size = 'md' as const }) {
  const setUser = useSetAtom(userAtom);
  const provider = process.env.NEXT_PUBLIC_LOGIN_PROVIDER ?? 'google';

  const startLogin = () => {
    // Redirect to backend OIDC start; backend will redirect back to this page
    const returnTo = typeof window !== 'undefined' ? window.location.href : '/';
    window.location.href = endpoints.authStart(provider, returnTo);
  };

  return (
    <div className="flex items-center gap-2">
      <Button size={size} onClick={startLogin}>Sign in with {provider}</Button>
      <Button size={size} variant="ghost" onClick={() => setUser({ loggedIn: false })}>Continue as guest</Button>
    </div>
  );
}
