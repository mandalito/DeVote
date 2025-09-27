'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { postJSON } from '@/lib/api';

export default function TeamRegistrationPage() {
  const [pollId, setPollId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [member1, setMember1] = useState('');
  const [member2, setMember2] = useState('');
  const [member3, setMember3] = useState('');
  const [member4, setMember4] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const members = [member1, member2, member3, member4].filter(Boolean);

    if (!pollId || !teamId || !projectId || members.length !== 4) {
      setError('All fields are required, and exactly 4 team members must be entered.');
      return;
    }

    try {
      await postJSON('/admin/register-team', {
        pollId,
        teamId: Number(teamId),
        projectId,
        memberIdentifiers: members.map(email => ({ provider: 'google', email })),
      });
      setMessage('Team registered successfully!');
      // Optionally clear the form
      setPollId('');
      setTeamId('');
      setProjectId('');
      setMember1('');
      setMember2('');
      setMember3('');
      setMember4('');
    } catch (err: any) {
      console.error('Team registration failed:', err);
      setError(err.message || 'Failed to register team.');
    }
  };

  return (
    <div className="grid gap-6 max-w-lg mx-auto p-6 border border-zinc-800 rounded-xl">
      <h1 className="text-2xl font-semibold text-center">Team Registration</h1>
      <p className="text-sm text-zinc-400 text-center">Enter the details for your team. Exactly 4 members are required.</p>

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
          <p className="text-sm text-zinc-400">Team Members (email addresses - exactly 4):</p>
          <Input type="email" placeholder="Member 1 Email" value={member1} onChange={(e) => setMember1(e.target.value)} required />
          <Input type="email" placeholder="Member 2 Email" value={member2} onChange={(e) => setMember2(e.target.value)} required />
          <Input type="email" placeholder="Member 3 Email" value={member3} onChange={(e) => setMember3(e.target.value)} required />
          <Input type="email" placeholder="Member 4 Email" value={member4} onChange={(e) => setMember4(e.target.value)} required />
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
