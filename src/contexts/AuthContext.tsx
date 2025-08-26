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

const ensureUserIsInUsersTable = async (user: User, signupMethod: 'email' | 'google') => {
  console.log("Running ensureUserIsInUsersTable with method:", signupMethod);
  try {
    // Check if user exists in users table
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id, signup_method')
      .eq('id', user.id)
      .single();

    // If user doesn't exist, only insert if signing up with email
    if (!existingUser && signupMethod === 'email') {
      console.log("User not found in users table. Inserting with email signup method...");
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          signup_method: 'email'
        });

      if (insertError) {
        console.error('Error inserting user:', insertError);
      } else {
        console.log('✅ User inserted successfully into users table with email signup method.');
      }
    } else if (!existingUser && signupMethod === 'google') {
      console.log('❌ Google OAuth user attempted to sign in without prior email signup');
      // Don't insert Google OAuth users automatically
      return false; // Signal that user shouldn't be allowed
    }
    return true; // User exists or was created successfully
  } catch (error) {
    console.error('Error in ensureUserIsInUsersTable:', error);
    return false;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Log OAuth events for debugging
        if (event === 'SIGNED_IN') {
          console.log('User signed in successfully');
          // Handle OAuth callback hash
          if (window.location.hash && window.location.hash.includes('access_token')) {
            console.log('OAuth callback detected, processing...');
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (newSession) {
              console.log('Session established from OAuth callback');
              setSession(newSession);
              setUser(newSession.user);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed');
        } else if (event === 'USER_UPDATED') {
          console.log('User data updated');
        }
      }
    );

    // THEN check for existing session or OAuth callback
    const checkSession = async () => {
      // Check if this is an OAuth callback
      if (window.location.hash && window.location.hash.includes('access_token')) {
        console.log('OAuth callback URL detected');
        // Give Supabase time to process the callback
        setTimeout(async () => {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error getting session:', error);
          } else {
            console.log('AuthContext: Session from OAuth:', session);
            setSession(session);
            setUser(session?.user ?? null);
          }
        }, 100);
      } else {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting initial session:', error);
        } else {
          console.log('AuthContext: Initial session check:', session);
          setSession(session);
          setUser(session?.user ?? null);
        }
      }
    };
    
    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};