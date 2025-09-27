'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getJSON, postJSON } from '@/lib/api';
import type { RegisterTeamPayload } from '@/types';

// Define an interface for authenticated users (assuming backend provides ID and email)
interface AuthenticatedUser {
  id: string;
  email: string;
}

export default function TeamRegistrationPage() {
  const [pollId, setPollId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [authenticatedUsers, setAuthenticatedUsers] = useState<AuthenticatedUser[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(['', '', '', '']);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch authenticated users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // TODO: Replace with your actual backend API endpoint for authenticated users
        const users = await getJSON<AuthenticatedUser[]>('/api/authenticated-users').catch(() => []);
        setAuthenticatedUsers(users);
      } catch (err) {
        console.error('Failed to fetch authenticated users:', err);
        setError('Failed to load authenticated users. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleMemberSelection = (index: number, userId: string) => {
    const newSelectedMemberIds = [...selectedMemberIds];
    newSelectedMemberIds[index] = userId;
    setSelectedMemberIds(newSelectedMemberIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const membersToRegister = selectedMemberIds.filter(id => id !== '');

    if (!pollId || !teamId || !projectId || membersToRegister.length !== 4) {
      setError('All fields are required, and exactly 4 team members must be selected.');
      return;
    }

    try {
      const payload: RegisterTeamPayload = {
        pollId,
        teamId: Number(teamId),
        projectId,
        memberUserIds: membersToRegister,
      };
      
      // TODO: Ensure your backend /admin/register-team endpoint expects `memberUserIds`
      await postJSON('/admin/register-team', payload);
      setMessage('Team registered successfully!');
      // Optionally clear the form
      setPollId('');
      setTeamId('');
      setProjectId('');
      setSelectedMemberIds(['', '', '', '']);
    } catch (err: any) {
      console.error('Team registration failed:', err);
      setError(err.message || 'Failed to register team.');
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-6 max-w-lg mx-auto p-6 border border-zinc-800 rounded-xl text-center">
        <h1 className="text-2xl font-semibold">Loading Authenticated Users...</h1>
        <p className="text-zinc-400">Please ensure your backend provides the `/api/authenticated-users` endpoint.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 max-w-lg mx-auto p-6 border border-zinc-800 rounded-xl">
      <h1 className="text-2xl font-semibold text-center">Team Registration</h1>
      <p className="text-sm text-zinc-400 text-center">Select up to 4 members for your team from the authenticated users list.</p>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <Input
          placeholder="Poll ID (e.g., current-contest-poll)"
          value={pollId}
          onChange={(e) => setPollId(e.target.value)}
          required
        />
        <Input
          type="number"
          placeholder="Team ID (a unique number for your team)"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          required
        />
        <Input
          placeholder="Project ID (must be a valid project in the poll)"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
        />
        <div className="grid gap-2">
          <p className="text-sm text-zinc-400">Team Members (select exactly 4):</p>
          {[0, 1, 2, 3].map(index => (
            <select
              key={index}
              value={selectedMemberIds[index]}
              onChange={(e) => handleMemberSelection(index, e.target.value)}
              className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm ring-offset-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="" disabled>Select Member {index + 1}</option>
              {authenticatedUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} (ID: {user.id})
                </option>
              ))}
            </select>
          ))}
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        {message && <p className="text-sm text-green-400 text-center">{message}</p>}

        <Button type="submit" className="w-full">
          Register Team
        </Button>
      </form>
    </div>
  );
}
