'use client';

import { useEffect, useState } from 'react';
import { getJSON } from '@/lib/api';
import type { PollDetail } from '@/types';
import ProjectCard from '@/components/ProjectCard';
import TallyBoard from '@/components/TallyBoard';

export default function PollDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [poll, setPoll] = useState<PollDetail | null>(null);

  useEffect(() => {
    let on = true;
    const load = async () => {
      const d = await getJSON<PollDetail>(`/poll/${id}`).catch(() => null);
      if (on) setPoll(d);
    };
    load();
    const t = setInterval(load, 5000);
    return () => { on = false; clearInterval(t); };
  }, [id]);

  if (!poll) return <div>Loading…</div>;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{poll.name}</h1>
        <p className="text-sm text-zinc-400">{poll.description}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {poll.choices.map(c => (
          <ProjectCard
            key={c.projectId}
            pollId={poll.id}
            projectId={c.projectId}
            name={c.name}
            teamId={c.teamId}
            disabled={poll.finalized}
          />
        ))}
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-semibold">Live Tally</div>
        <TallyBoard pollId={poll.id} />
      </div>
    </div>
  );
}
