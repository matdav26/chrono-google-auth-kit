import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('AuthCallback: Processing authentication callback...');
        
        // Get the hash parameters from the URL (OAuth response)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const errorParam = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        // Check for OAuth errors
        if (errorParam) {
          console.error('OAuth error:', errorParam, errorDescription);
          setError(errorDescription || 'Authentication failed');
          setLoading(false);
          return;
        }
        
        // Check for current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
          setLoading(false);
          return;
        }
        
        if (session) {
          console.log('AuthCallback: Session established successfully for:', session.user.email);
          
          // Show success toast
          toast({
            title: "Welcome back!",
            description: `Successfully signed in as ${session.user.email}`,
          });
          
          // Redirect to projects page
          navigate('/projects', { replace: true });
        } else {
          console.log('AuthCallback: No session found, redirecting to login');
          
          // No session found, redirect to login
          toast({
            title: "Authentication Required",
            description: "Please sign in to continue",
            variant: "destructive"
          });
          
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('AuthCallback: Unexpected error:', error);
        setError('An unexpected error occurred during authentication');
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Completing sign in...
            </CardTitle>
            <CardDescription>
              Please wait while we complete your authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">
              Authentication Failed
            </CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                There was a problem signing you in. Please try again.
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => navigate('/', { replace: true })}
                  variant="default"
                >
                  Back to Login
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback (should not reach here normally)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Processing...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you're not redirected automatically, 
            <Button 
              variant="link" 
              className="px-1"
              onClick={() => navigate('/', { replace: true })}
            >
              click here
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;