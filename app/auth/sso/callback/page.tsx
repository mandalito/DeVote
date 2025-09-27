'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getJSON } from '@/lib/api';
import { useSetAtom } from 'jotai';
import { userAtom, type UserState } from '@/lib/state';
import { Button } from '@/components/ui/button';

export default function SSOCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useSetAtom(userAtom);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Authenticating...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`Authentication failed: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Call backend to exchange code for user info
        const userData = await getJSON<UserState>(`/auth/sso/callback?code=${code}&state=${state || ''}`);
        
        // Update user state
        setUser({
          loggedIn: true,
          ...userData
        });

        setStatus('success');
        setMessage('Authentication successful! Redirecting...');

        // Redirect to return URL or home
        const returnTo = searchParams.get('returnTo') || '/';
        setTimeout(() => {
          router.push(returnTo);
        }, 2000);

      } catch (error: any) {
        console.error('SSO callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication failed');
      }
    };

    handleCallback();
  }, [searchParams, setUser, router]);

  const handleRetry = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">
          {status === 'loading' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>
        
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {status === 'loading' && 'Authenticating...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Failed'}
          </h1>
          <p className="text-zinc-400">{message}</p>
        </div>

        {status === 'error' && (
          <Button onClick={handleRetry} variant="outline">
            Try Again
          </Button>
        )}

        {status === 'loading' && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        )}
      </div>
    </div>
  );
}
