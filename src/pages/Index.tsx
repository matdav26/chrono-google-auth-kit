import { AuthForm } from '@/components/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome back!</h1>
        <p className="text-xl text-muted-foreground mb-6">
          You're successfully signed in as {user.email}
        </p>
        <Button onClick={signOut} variant="outline">
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Index;