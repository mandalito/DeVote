'use client';

import { useEffect, useState } from 'react';
import { getJSON } from '@/lib/api';
import type { PollDetail } from '@/types';

export default function TallyBoard({ pollId }: { pollId: string }) {
  const [data, setData] = useState<PollDetail | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchTally = async () => {
      const d = await getJSON<PollDetail>(`/poll/${pollId}`);
      if (alive) setData(d);
    };
    fetchTally();
    const id = setInterval(fetchTally, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [pollId]);

  if (!data) return <div className="text-sm text-zinc-400">Loading…</div>;

  return (
    <div className="grid gap-3">
      {data.choices.map(c => (
        <div key={c.projectId} className="flex items-center justify-between rounded-xl border border-zinc-800 p-3">
          <div className="text-sm">{c.name}</div>
          <div className="text-xs text-zinc-400">{data.tally[c.projectId] ?? 0} votes</div>
        </div>
      ))}
    </div>
  );
}
