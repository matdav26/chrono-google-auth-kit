import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processing OAuth callback...');
        console.log('📍 Current URL:', window.location.href);
        console.log('🔍 URL parameters:', window.location.search);
        
        // Wait a bit for Supabase to process the callback
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the current session after OAuth redirect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('📋 Session data:', session);
        console.log('❌ Session error:', sessionError);
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setError(sessionError.message);
          setStatus('error');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        if (session && session.user) {
          console.log('✅ Authentication successful:', session.user.email);
          setStatus('success');
          
          // Redirect to projects page after successful auth
          setTimeout(() => {
            navigate('/projects');
          }, 1000);
        } else {
          console.log('❌ No session found after OAuth callback');
          console.log('🔍 Trying to get user directly...');
          
          // Try getting user directly
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          console.log('👤 User data:', user);
          console.log('❌ User error:', userError);
          
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
  }, [navigate]);

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