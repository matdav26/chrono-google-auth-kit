import { useEffect, useState } from "react";
import { AuthForm } from '@/components/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { user, signOut } = useAuth();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {!user ? (
        <AuthForm />
      ) : (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome back!</h1>
          <p className="text-xl text-muted-foreground mb-6">
            You're successfully signed in as {user.email}
          </p>
          <Button onClick={signOut} variant="outline">
            Sign Out
          </Button>
        </div>
      )}
      
      {/* DEBUG: show session */}
      <pre style={{ marginTop: 20, padding: 10, background: "#eee" }}>
        {JSON.stringify(session, null, 2) || "no session yet"}
      </pre>
    </div>
  );
};

export default Index;