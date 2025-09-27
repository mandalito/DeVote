import { getJSON } from '@/lib/api';
import Link from 'next/link';
import type { PollSummary } from '@/types';
import { fmtTime } from '@/lib/utils';
import SSOLoginButton from '@/components/SSOLoginButton';

export default async function HomePage() {
  const polls = await getJSON<PollSummary[]>('/polls').catch(() => []);
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Active Polls</h1>
        <SSOLoginButton />
      </div>
      {polls.length === 0 ? (
        <div className="text-sm text-zinc-400">No polls yet.</div>
      ) : (
        <div className="grid gap-3">
          {polls.map(p => (
            <Link key={p.id} href={`/poll/${p.id}`} className="block rounded-xl border border-zinc-800 p-4 hover:bg-zinc-900/50">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-400">Deadline: {fmtTime(p.deadlineMs)} • {p.finalized ? 'Finalized' : 'Open'}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
