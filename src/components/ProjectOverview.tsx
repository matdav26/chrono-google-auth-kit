import { ProjectStats } from './ProjectStats';
import { ChronoBoardAI } from './ChronoBoardAI';
import { HorizontalTimeline } from './HorizontalTimeline';

interface ProjectOverviewProps {
  projectId: string;
}

export const ProjectOverview = ({ projectId }: ProjectOverviewProps) => {
  return (
    <div className="space-y-6">
      <ProjectStats projectId={projectId} />
      <ChronoBoardAI projectId={projectId} />
      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <HorizontalTimeline projectId={projectId} preview={true} />
      </div>
    </div>
  );
};