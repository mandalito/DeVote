'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { detectUniversityFromEmail, getSSORedirectUrl, isValidUniversityEmail, type UniversityConfig } from '@/lib/university';
import { useSetAtom } from 'jotai';
import { userAtom } from '@/lib/state';
import { postJSON, endpoints } from '@/lib/api'; // Import postJSON and endpoints

interface SSOLoginButtonProps {
  size?: 'sm' | 'md' | 'lg';
  onLoginStart?: (email: string, university: UniversityConfig) => void;
}

export default function SSOLoginButton({ size = 'md', onLoginStart }: SSOLoginButtonProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'manual' | 'processing'>('email'); // Removed 'confirm' step
  const [detectedUniversity, setDetectedUniversity] = useState<UniversityConfig | null>(null);
  const [manualSsoUrl, setManualSsoUrl] = useState('');
  const [error, setError] = useState<string>('');
  const [authMessage, setAuthMessage] = useState<string>('');
  const setUser = useSetAtom(userAtom);

  const performDomainAuthentication = async (targetEmail: string, universityConfig: UniversityConfig | null) => {
    setStep('processing');
    setAuthMessage('Authenticating your domain...');
    setError('');

    try {
      // Simulate 5-second waiting time
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Call backend API to store email
      await postJSON(endpoints.authenticateEmail(), { email: targetEmail });

      setAuthMessage(`You are authenticated as ${targetEmail}!`);
      setUser({
        loggedIn: true,
        email: targetEmail,
        university: universityConfig?.name,
      });
      // No redirection, stay on the login page to show message
    } catch (err: any) {
      console.error('Domain authentication failed:', err);
      setError(err.message || 'Failed to authenticate domain. Please try again.');
      setAuthMessage(''); // Clear success message on error
      setUser({ loggedIn: false }); // Ensure user is not logged in on error
      setStep('email'); // Go back to email input on error
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const isUniEmail = isValidUniversityEmail(email);
    if (!isUniEmail) {
      setError('Please enter a valid university email address.');
      return;
    }

    const university = detectUniversityFromEmail(email);

    // Always perform domain authentication if it's a university email.
    await performDomainAuthentication(email, university);
  };

  const handleSSOLogin = (ssoUrlToUse: string) => {
    if (!ssoUrlToUse) {
      setError('SSO URL is missing. Please provide a valid URL.');
      return;
    }

    if (onLoginStart && detectedUniversity) {
      onLoginStart(email, detectedUniversity);
    }

    setUser({ loggedIn: false, email, university: detectedUniversity?.name });

    const returnTo = typeof window !== 'undefined' ? window.location.href : '/';
    const fullSsoRedirectUrl = getSSORedirectUrl(detectedUniversity || { name: 'manual', domain: email.split('@')[1], displayName: 'Manual Entry', ssoUrl: ssoUrlToUse }, returnTo);

    if (typeof window !== 'undefined') {
      window.location.href = fullSsoRedirectUrl;
    }
  };

  const handleManualSsoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!manualSsoUrl.trim()) {
      setError('Please enter the SSO URL.');
      return;
    }
    try {
      new URL(manualSsoUrl); // Validate URL format
    } catch (_) {
      setError('Please enter a valid URL.');
      return;
    }

    // If manual SSO URL is provided, it's a direct SSO flow, not domain authentication
    handleSSOLogin(manualSsoUrl);
  };

  const handleBack = () => {
    setStep('email');
    setDetectedUniversity(null);
    setManualSsoUrl('');
    setError('');
    setAuthMessage(''); // Clear auth message on back
  };

  const handleGuestLogin = async () => {
    const isUniEmail = isValidUniversityEmail(email);
    if (isUniEmail) {
      const university = detectUniversityFromEmail(email);
      await performDomainAuthentication(email, university);
    } else {
      setUser({ loggedIn: false });
      // No redirection, stay on the login page
    }
  };

  if (step === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-semibold mb-2">{authMessage}</h2>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // Removed 'confirm' step here

  if (step === 'manual') {
    return (
      <div className="flex flex-col gap-3 max-w-sm">
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <h3 className="font-semibold">Enter SSO URL Manually</h3>
          <p className="text-sm text-zinc-400">
            We couldn't automatically find the login page for {detectedUniversity?.displayName || 'your university'}. 
            Please enter the full SSO login URL below.
          </p>
        </div>
        
        <form onSubmit={handleManualSsoSubmit} className="flex flex-col gap-3">
          <Input
            type="url"
            placeholder="https://sso.your-university.edu/login"
            value={manualSsoUrl}
            onChange={(e) => setManualSsoUrl(e.target.value)}
            className="text-center"
          />
          
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
          
          <Button type="submit" size={size}>
            Continue to Login
          </Button>
        </form>

        <Button 
          size={size} 
          variant="ghost" 
          onClick={handleBack}
          className="text-xs"
        >
          ← Back to email input
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <div className="text-center">
        <div className="text-2xl mb-2">🎓</div>
        <h3 className="font-semibold">Student Login</h3>
        <p className="text-sm text-zinc-400">Enter your university email to sign in</p>
      </div>

      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <Input
          type="email"
          placeholder="student@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-center"
        />
        
        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}
        
        <Button type="submit" size={size}>
          Continue
        </Button>
      </form>

      <Button 
        size={size} 
        variant="ghost" 
        onClick={handleGuestLogin}
        className="text-xs"
      >
        Continue as guest instead
      </Button>
    </div>
  );
}
