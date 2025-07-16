import { useEffect, useState } from "react";
import { AuthForm } from '@/components/AuthForm';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
      }
    );

    // Clean up listener on unmount
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {!session ? (
        <AuthForm />
      ) : (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome back!</h1>
          <p className="text-xl text-muted-foreground mb-6">
            You're successfully signed in as {session.user.email}
          </p>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>
      )}
      
      {/* Debug: Display current session */}
      <pre style={{ marginTop: 20, padding: 10, background: "#eee", fontSize: 12 }}>
        {JSON.stringify(session, null, 2) || "No session"}
      </pre>
    </div>
  );
};

export default Index;