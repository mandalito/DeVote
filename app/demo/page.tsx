'use client';

import { useState } from 'react';
import { detectUniversityFromEmail, UNIVERSITY_CONFIGS, type UniversityConfig } from '@/lib/university';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function DemoPage() {
  const [email, setEmail] = useState('');
  const [detectedUniversity, setDetectedUniversity] = useState<UniversityConfig | null>(null);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    
    if (newEmail.includes('@')) {
      const university = detectUniversityFromEmail(newEmail);
      setDetectedUniversity(university);
    } else {
      setDetectedUniversity(null);
    }
  };

  const testEmails = [
    'student@polimi.it',
    'john.doe@unimi.it',
    'alice@unibo.it',
    'bob@uniroma1.it',
    'charlie@unito.it',
    'diana@unina.it',
    'test@unknown.edu'
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">🎓 University SSO Demo</h1>
        <p className="text-zinc-400">
          Test the university detection system with different email addresses
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Email Input Demo */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Email Detection</h2>
          <Input
            type="email"
            placeholder="Enter university email..."
            value={email}
            onChange={handleEmailChange}
            className="w-full"
          />
          
          {detectedUniversity ? (
            <div className="p-4 bg-green-900/20 border border-green-800 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{detectedUniversity.icon}</span>
                <div>
                  <div className="font-semibold">{detectedUniversity.displayName}</div>
                  <div className="text-sm text-green-400">
                    Domain: {detectedUniversity.domain}
                  </div>
                </div>
              </div>
            </div>
          ) : email && email.includes('@') ? (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl">
              <div className="text-red-400">
                ❌ University not recognized
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="font-medium">Quick Test:</h3>
            <div className="flex flex-wrap gap-2">
              {testEmails.map((testEmail) => (
                <Button
                  key={testEmail}
                  variant="outline"
                  size="sm"
                  onClick={() => setEmail(testEmail)}
                  className="text-xs"
                >
                  {testEmail}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Supported Universities */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Supported Universities</h2>
          <div className="space-y-3">
            {UNIVERSITY_CONFIGS.map((university) => (
              <div key={university.name} className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl">
                <span className="text-2xl">{university.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{university.displayName}</div>
                  <div className="text-sm text-zinc-400">{university.domain}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmail(`student@${university.domain}`)}
                >
                  Test
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SSO Flow Demo */}
      <div className="bg-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">SSO Authentication Flow</h2>
        <div className="grid md:grid-cols-4 gap-4 text-center">
          <div className="space-y-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl">
              1️⃣
            </div>
            <div className="font-medium">Enter Email</div>
            <div className="text-sm text-zinc-400">Student enters university email</div>
          </div>
          <div className="space-y-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl">
              2️⃣
            </div>
            <div className="font-medium">Detect University</div>
            <div className="text-sm text-zinc-400">System identifies university from domain</div>
          </div>
          <div className="space-y-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl">
              3️⃣
            </div>
            <div className="font-medium">SSO Redirect</div>
            <div className="text-sm text-zinc-400">Redirect to university login portal</div>
          </div>
          <div className="space-y-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl">
              4️⃣
            </div>
            <div className="font-medium">Authenticated</div>
            <div className="text-sm text-zinc-400">User returns authenticated</div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Button 
          onClick={() => window.location.href = '/'}
          variant="outline"
        >
          ← Back to Main App
        </Button>
      </div>
    </div>
  );
}
