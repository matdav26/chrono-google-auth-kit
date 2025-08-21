import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DocumentsPanel, DocumentsPanelRef } from '@/components/DocumentsPanel';
import { ProjectLogs } from '@/components/ProjectLogs';
import { HorizontalTimeline } from '@/components/HorizontalTimeline';
import { EventCreation } from '@/components/EventCreation';
import { ProjectNavigation, ProjectSection } from '@/components/ProjectNavigation';
import { ProjectOverview } from '@/components/ProjectOverview';
import { EventsPanel } from '@/components/EventsPanel';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

const ProjectView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentsRef, setDocumentsRef] = useState<DocumentsPanelRef | null>(null);
  const [currentSection, setCurrentSection] = useState<ProjectSection>('overview');

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) {
        navigate('/projects');
        return;
      }

      try {
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/');
          return;
        }

        // Fetch project
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching project:', error);
          toast({
            title: "Error",
            description: "Failed to load project",
            variant: "destructive",
          });
          navigate('/projects');
          return;
        }

        setProject(data);
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
        navigate('/projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'overview':
        return <ProjectOverview projectId={project.id} onSectionChange={setCurrentSection} />;
      case 'documents':
        return (
          <DocumentsPanel 
            projectId={project.id} 
            ref={setDocumentsRef}
          />
        );
      case 'timeline':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Project Timeline</h2>
              <EventCreation projectId={project.id} />
            </div>
            <HorizontalTimeline projectId={project.id} />
            <ProjectLogs projectId={project.id} />
          </div>
        );
      case 'events':
        return <EventsPanel projectId={project.id} />;
      default:
        return <ProjectOverview projectId={project.id} />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {project.name || 'Untitled Project'}
          </h1>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>

        <ProjectNavigation 
          currentSection={currentSection} 
          onSectionChange={setCurrentSection} 
        />

        {renderCurrentSection()}
      </div>
    </div>
  );
};

export default ProjectView;