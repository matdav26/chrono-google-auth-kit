import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Trash2, Plus, Search, Eye, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSessionAndFetchProjects = async () => {
      try {
        // Check if user has a session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/');
          return;
        }

        // Store user email
        setUserEmail(session.user.email || null);

        // Fetch projects
        const { data, error } = await supabase
          .from('projects')
          .select('*');

        if (error) {
          setError(error.message);
        } else {
          setProjects(data || []);
        }
      } catch (err) {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    checkSessionAndFetchProjects();
  }, [navigate]);

  const handleDeleteProject = async (projectId: string) => {
    try {
      setDeleting(projectId);
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      
      // Remove project from local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    } catch (err) {
      console.error('Error deleting project:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to delete project',
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleRenameProject = async (projectId: string) => {
    if (!editingName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid name",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: editingName.trim() })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project renamed successfully",
      });

      setEditingProject(null);
      setEditingName('');
      
      // Update local state
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, name: editingName.trim() } : p
      ));
    } catch (err) {
      console.error('Error renaming project:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to rename project",
        variant: "destructive",
      });
    }
  };

  const startEditing = (project: Project) => {
    setEditingProject(project.id);
    setEditingName(project.name);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-destructive text-center">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Your Project Workspace</h1>
          <div className="flex items-center gap-4">
            {userEmail && (
              <span className="text-sm text-muted-foreground">{userEmail}</span>
            )}
            <Button onClick={handleSignOut} variant="outline" size="sm">
              Sign Out
            </Button>
            <Button onClick={() => navigate('/new-project')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>
        </div>
        
        {projects.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {projects.length === 0 ? 'No projects found.' : 'No projects match your search.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="p-6 border border-border rounded-lg bg-card hover:shadow-md transition-all duration-200 hover:border-primary/20"
              >
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    {editingProject === project.id ? (
                      <div className="mb-4">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="text-lg font-semibold mb-3"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameProject(project.id);
                            if (e.key === 'Escape') setEditingProject(null);
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleRenameProject(project.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingProject(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold text-card-foreground mb-2">
                          {project.name || 'Untitled project'}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-8">
                          Created on {new Date(project.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="flex flex-col items-center p-3 h-auto"
                      >
                        <Eye className="h-5 w-5 mb-1" />
                        <span className="text-xs">View</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(project)}
                        disabled={editingProject === project.id}
                        className="flex flex-col items-center p-3 h-auto"
                      >
                        <Edit className="h-5 w-5 mb-1" />
                        <span className="text-xs">Edit</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={deleting === project.id}
                            className="flex flex-col items-center p-3 h-auto"
                          >
                            {deleting === project.id ? (
                              <Loader2 className="h-5 w-5 mb-1 animate-spin" />
                            ) : (
                              <Trash2 className="h-5 w-5 mb-1" />
                            )}
                            <span className="text-xs">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Project</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{project.name || 'Untitled project'}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProject(project.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {/* This will be populated with document count in the future */}
                      {/* 5 Files */}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;