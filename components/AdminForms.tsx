'use client';

import { useState } from 'react';
import { postJSON } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CreatePollForm() {
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [choices, setChoices] = useState(''); // comma separated: "p1:Team A,p2:Team B"

  const submit = async () => {
    const parsed = choices.split(',').map(s => {
      const [projectId, label] = s.split(':').map(x => x.trim());
      return { projectId, name: label ?? projectId };
    });
    await postJSON('/admin/create-poll', { name, deadlineMs: Number(deadline), choices: parsed });
    setName(''); setDeadline(''); setChoices('');
    alert('Poll created');
  };

  return (
    <div className="grid gap-2 border border-zinc-800 rounded-2xl p-4">
      <div className="text-sm font-semibold">Create Poll</div>
      <Input placeholder="Poll name" value={name} onChange={e => setName(e.target.value)} />
      <Input placeholder="Deadline (ms epoch)" value={deadline} onChange={e => setDeadline(e.target.value)} />
      <Input placeholder='Choices "p1:Team A,p2:Team B,p3:Team C"' value={choices} onChange={e => setChoices(e.target.value)} />
      <Button onClick={submit}>Create</Button>
    </div>
  );
}

export function RegisterTeamForm() {
  const [pollId, setPollId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [members, setMembers] = useState(''); // comma: emails or tokens (4)

  const submit = async () => {
    const arr = members.split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length !== 4) return alert('Exactly 4 members required');
    // backend will turn identifiers -> nullifier hashes
    await postJSON('/admin/register-team', {
      pollId, teamId: Number(teamId), projectId,
      memberIdentifiers: arr.map(email => ({ provider: 'google', email })),
    });
    alert('Team registered');
  };

  return (
    <div className="grid gap-2 border border-zinc-800 rounded-2xl p-4">
      <div className="text-sm font-semibold">Register Team (4 members)</div>
      <Input placeholder="Poll ID" value={pollId} onChange={e => setPollId(e.target.value)} />
      <Input placeholder="Team ID (number)" value={teamId} onChange={e => setTeamId(e.target.value)} />
      <Input placeholder="Project ID (must be in choices)" value={projectId} onChange={e => setProjectId(e.target.value)} />
      <Input placeholder="Member emails (comma, exactly 4)" value={members} onChange={e => setMembers(e.target.value)} />
      <Button onClick={submit}>Register</Button>
    </div>
  );
}
