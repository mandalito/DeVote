'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SSOLoginButton from '@/components/SSOLoginButton';
import { endpoints } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleLoginStart = async (email: string, university: any) => {
    setIsRedirecting(true);
    
    try {
      // Optionally, you can call your backend first to initiate the SSO flow
      const returnTo = typeof window !== 'undefined' ? window.location.searchParams.get('returnTo') || '/' : '/';
      const ssoUrl = endpoints.ssoStart(university.name, email, returnTo);
      
      // Redirect to backend SSO endpoint (which will then redirect to university)
      window.location.href = ssoUrl;
    } catch (error) {
      console.error('Login error:', error);
      setIsRedirecting(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Redirecting to University Login</h2>
          <p className="text-zinc-400">Please wait while we redirect you to your university's authentication system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">🎓</div>
          <h1 className="text-3xl font-bold">Student Login</h1>
          <p className="text-zinc-400 mt-2">
            Sign in with your university credentials to participate in voting
          </p>
        </div>

        <div className="bg-zinc-800 rounded-2xl p-6">
          <SSOLoginButton onLoginStart={handleLoginStart} />
        </div>

        <div className="text-center">
          <p className="text-xs text-zinc-500">
            By signing in, you agree to our terms of service and privacy policy.
            Your university credentials are securely handled through your institution's SSO system.
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="text-sm text-zinc-400 hover:text-zinc-300 underline"
          >
            ← Go back
          </button>
        </div>
      </div>
    </div>
  );
}
