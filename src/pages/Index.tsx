import { useEffect, useState } from "react";
import { AuthForm } from '@/components/AuthForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Plus, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Project = Tables<'projects'>;

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        
        // Handle OAuth callback - redirect to projects after successful login
        if (event === 'SIGNED_IN' && session) {
          // Check if this is an OAuth callback (URL has hash fragments)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          if (hashParams.get('access_token')) {
            console.log('OAuth callback detected, session established');
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log('Initial session check:', session);
    });

    // Clean up listener on unmount
    return () => subscription.unsubscribe();
  }, []);

  // Fetch projects when user is authenticated
  useEffect(() => {
    if (session?.user) {
      fetchProjects();
    } else {
      setLoading(false);
      setProjects([]);
    }
  }, [session]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setProjects(data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    const name = prompt('Enter project name:');
    if (!name?.trim()) return;

    try {
      setCreating(true);
      
      console.log("Creating project:", { name: name.trim(), created_by: session.user.id });
      
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{ 
          name: name.trim(),
          created_by: session.user.id, // Explicitly set the created_by field
        }])
        .select()
        .single();

      if (projectError) throw projectError;
      
      // Create project membership for the owner
      const { error: membershipError } = await supabase
        .from('project_memberships')
        .insert({
          project_id: project.id,
          user_id: session.user.id,
          role: 'owner'
        });

      if (membershipError) throw membershipError;
      
      // Prepend new project to the list
      setProjects(prev => [project, ...prev]);
      
      toast({
        title: "Success",
        description: "Project created successfully",
      });
    } catch (err) {
      console.error('Error creating project:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to create project',
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Your Project Workspace</h1>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm">
              {session.user.email}
            </span>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              Sign Out
            </Button>
            <Button 
              onClick={handleCreateProject} 
              disabled={creating}
              className="flex items-center gap-2"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-destructive text-lg">{error}</p>
            <Button 
              onClick={fetchProjects} 
              variant="outline" 
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No projects yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first project to get started.
            </p>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && !error && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{project.name}</span>
                  </CardTitle>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Created {formatDate(project.created_at)}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.href = `/projects/${project.id}`}
                      >
                        View →
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={deleting === project.id}
                          >
                            {deleting === project.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Project</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{project.name}"? This action cannot be undone.
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;