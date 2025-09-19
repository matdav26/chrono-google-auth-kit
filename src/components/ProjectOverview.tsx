import { ProjectStats } from './ProjectStats';
// import { ChronoBoardAI } from './ChronoBoardAI'; // RAG feature temporarily disabled
import { HorizontalTimeline } from './HorizontalTimeline';
import { EventCreation } from './EventCreation';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface ProjectOverviewProps {
  projectId: string;
  onSectionChange?: (section: 'timeline') => void;
}

export const ProjectOverview = ({ projectId, onSectionChange }: ProjectOverviewProps) => {
  return (
    <div className="space-y-8">
      <ProjectStats projectId={projectId} />
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Latest Updates</h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onSectionChange?.('timeline')}
            className="text-sm"
          >
            View Full Timeline
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        <HorizontalTimeline projectId={projectId} preview={true} />
      </div>
      
      {/* RAG feature temporarily disabled - can be re-enabled by uncommenting */}
      {/* <ChronoBoardAI projectId={projectId} /> */}
    </div>
  );
};