import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { handleGoogleOAuthValidation } from '../lib/auth-helpers';
import { useToast } from '@/hooks/use-toast';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processing auth callback...');
        console.log('📍 Current URL:', window.location.href);
        
        // Wait a bit for Supabase to process the callback
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the current session after redirect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('📋 Session data:', session);
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setError(sessionError.message);
          setStatus('error');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        if (session && session.user) {
          console.log('✅ Authentication successful:', session.user.email);
          
          // Check if this is a Google OAuth login
          if (session.user.app_metadata?.provider === 'google') {
            // Validate Google OAuth login - check if user exists in database
            const validation = await handleGoogleOAuthValidation(session.user.id);
            
            if (!validation.success) {
              console.log('❌ Google OAuth validation failed');
              setError(validation.errorMessage || 'Authentication validation failed');
              setStatus('error');
              
              // Show toast notification
              toast({
                title: "Authentication Failed",
                description: validation.errorMessage,
                variant: "destructive",
              });
              
              setTimeout(() => navigate('/'), 3000);
              return;
            }
          } else {
            // For email signups after confirmation, ensure user is in the users table
            console.log('✉️ Email authentication detected, ensuring user record exists...');
            
            // Check if user exists in users table
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('id', session.user.id)
              .single();

            if (!existingUser) {
              // Insert user if doesn't exist
              const { error: insertError } = await supabase
                .from('users')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  signup_method: 'email'
                });

              if (insertError && insertError.code !== '23505') { // Ignore duplicate key errors
                console.error('❌ Error creating user record:', insertError);
              } else {
                console.log('✅ User record created successfully');
              }
            }
          }
          
          console.log('✅ User validation successful');
          setStatus('success');
          
          // Redirect to projects page after successful auth
          setTimeout(() => {
            navigate('/projects');
          }, 1000);
        } else {
          console.log('❌ No session found after callback');
          
          // Try getting user directly
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          console.log('👤 User data:', user);
          
          if (user) {
            // User exists but no session - might be email confirmation
            console.log('🔐 User found but no session, might be email confirmation');
            
            // Try to refresh session
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
            if (refreshedSession) {
              console.log('✅ Session refreshed successfully');
              setStatus('success');
              setTimeout(() => navigate('/projects'), 1000);
              return;
            }
          }
          
          setError('No session found after authentication');
          setStatus('error');
          setTimeout(() => navigate('/'), 3000);
        }
      } catch (error) {
        console.error('❌ Auth callback error:', error);
        setError('Authentication failed');
        setStatus('error');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing authentication...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-green-600 text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Successful!</h2>
          <p className="text-gray-600">Redirecting to your projects...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;