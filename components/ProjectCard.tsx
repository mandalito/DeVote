import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import VoteButton from './VoteButton';

export default function ProjectCard({
  pollId, projectId, name, teamId, disabled,
}: { pollId: string; projectId: string; name: string; teamId?: number; disabled?: boolean }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{name}</CardTitle>
      <CardDescription>Project ID: {projectId} {teamId !== undefined && <>• Team #{teamId}</>}</CardDescription>
      <VoteButton pollId={pollId} projectId={projectId} disabled={disabled} />
    </Card>
  );
}
