import { CreatePollForm, RegisterTeamForm } from '@/components/AdminForms';

export default function AdminPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <CreatePollForm />
        <RegisterTeamForm />
      </div>
      <p className="text-xs text-zinc-500">
        Note: This frontend assumes your backend enforces AdminCap/RegistrarCap checks and exposes
        /admin endpoints. The voting page uses wallet-less zkLogin (ephemeral key sent to backend).
      </p>
    </div>
  );
}
