import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const ensureUserIsInUsersTable = async (user: User) => {
  console.log("Running ensureUserIsInUsersTable...");
  try {
    // Check if user exists in users table
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    // If user doesn't exist, insert them
    if (!existingUser) {
      console.log("User not found in users table. Inserting now...");
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
        });

      if (insertError) {
        console.error('Error inserting user:', insertError);
      } else {
        console.log('✅ User inserted successfully into users table.');
      }
    }
  } catch (error) {
    console.error('Error in ensureUserIsInUsersTable:', error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const checkedUserRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ensure user exists in users table after authentication
  useEffect(() => {
    if (user && user.id !== checkedUserRef.current) {
      checkedUserRef.current = user.id;
      ensureUserIsInUsersTable(user);
    }
  }, [user]);

  const signOut = async () => {
    checkedUserRef.current = null;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};