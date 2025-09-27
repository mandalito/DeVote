'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (window.location.hash) {
      router.replace(`/zklogin${window.location.hash}`);
    } else {
      router.replace('/zklogin');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Logging in...</h2>
        <p className="text-zinc-400">Please wait while we complete your authentication.</p>
      </div>
    </div>
  );
}
