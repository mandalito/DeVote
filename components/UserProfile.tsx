'use client';

import { useAtomValue } from 'jotai';
import { userAtom } from '@/lib/state';
import { Button } from '@/components/ui/button';

interface UserProfileProps {
  showLogin?: boolean;
  onLoginClick?: () => void;
}

export default function UserProfile({ showLogin = true, onLoginClick }: UserProfileProps) {
  const user = useAtomValue(userAtom);

  if (!user || !user.loggedIn) {
    if (!showLogin) return null;
    
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onLoginClick}>
          Login with Student Account
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm font-medium">
          {user.name || user.email}
        </div>
        {user.university && (
          <div className="text-xs text-zinc-400">
            {user.university}
            {user.studentId && ` • ${user.studentId}`}
          </div>
        )}
      </div>
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
      </div>
    </div>
  );
}
