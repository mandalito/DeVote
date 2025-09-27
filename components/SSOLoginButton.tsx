'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { detectUniversityFromEmail, getSSORedirectUrl, isValidUniversityEmail, type UniversityConfig } from '@/lib/university';
import { useSetAtom } from 'jotai';
import { userAtom } from '@/lib/state';

interface SSOLoginButtonProps {
  size?: 'sm' | 'md' | 'lg';
  onLoginStart?: (email: string, university: UniversityConfig) => void;
}

export default function SSOLoginButton({ size = 'md', onLoginStart }: SSOLoginButtonProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'confirm' | 'manual'>('email');
  const [detectedUniversity, setDetectedUniversity] = useState<UniversityConfig | null>(null);
  const [manualSsoUrl, setManualSsoUrl] = useState('');
  const [error, setError] = useState<string>('');
  const setUser = useSetAtom(userAtom);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!isValidUniversityEmail(email)) {
      setError('Please enter a valid university email address');
      return;
    }

    const university = detectUniversityFromEmail(email);
    if (!university) {
      setError('University not recognized. Please contact support or enter your SSO URL manually.');
      setStep('manual');
      return;
    }

    if (!university.ssoUrl) {
      setError(`SSO URL for ${university.displayName} could not be determined. Please enter it manually.`);
      setDetectedUniversity(university);
      setStep('manual');
      return;
    }

    setDetectedUniversity(university);
    setStep('confirm');
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

  const handleManualSsoSubmit = (e: React.FormEvent) => {
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
    handleSSOLogin(manualSsoUrl);
  };

  const handleBack = () => {
    setStep('email');
    setDetectedUniversity(null);
    setManualSsoUrl('');
    setError('');
  };

  const handleGuestLogin = () => {
    setUser({ loggedIn: false });
  };

  if (step === 'confirm' && detectedUniversity) {
    return (
      <div className="flex flex-col gap-3 max-w-sm">
        <div className="text-center">
          <div className="text-2xl mb-2">{detectedUniversity.icon}</div>
          <h3 className="font-semibold">Login with {detectedUniversity.displayName}</h3>
          <p className="text-sm text-zinc-400">{email}</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size={size} 
            onClick={() => handleSSOLogin(detectedUniversity.ssoUrl)}
            className="flex-1"
          >
            Continue to {detectedUniversity.displayName}
          </Button>
          <Button 
            size={size} 
            variant="outline" 
            onClick={handleBack}
          >
            Back
          </Button>
        </div>
        
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
