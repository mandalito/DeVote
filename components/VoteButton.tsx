'use client';

import { Button } from '@/components/ui/button';
import { postJSON } from '@/lib/api';
import { getEphemeralPublicKeyB64 } from '@/lib/zklogin';
import { useState } from 'react';

export default function VoteButton({
  pollId, projectId, disabled,
}: { pollId: string; projectId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const castVote = async () => {
    try {
      setLoading(true); setError(null);
      const ephemeralPublicKey = getEphemeralPublicKeyB64();
      const res = await postJSON<{ ok: boolean; data?: { txDigest: string }; error?: string }>(
        '/vote',
        { pollId, projectId, ephemeralPublicKey },
      );
      if (res.ok && res.data?.txDigest) setTxDigest(res.data.txDigest);
      else setError(res.error ?? 'Vote failed');
    } catch (e: any) {
      setError(e?.message ?? 'Vote failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={castVote} disabled={disabled || loading}>
        {loading ? 'Casting…' : 'Vote'}
      </Button>
      {txDigest && (
        <a className="text-xs text-indigo-400 underline" href={`https://explorer.sui.io/txblock/${txDigest}?network=devnet`} target="_blank">
          View tx
        </a>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
