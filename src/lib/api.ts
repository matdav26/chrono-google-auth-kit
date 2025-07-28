import { supabase } from "@/integrations/supabase/client";

/**
 * Authenticated fetch wrapper that automatically includes Supabase JWT token
 * in the Authorization header for backend API calls
 */
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No authentication token available. User must be logged in.');
  }

  // Merge headers with Authorization token
  // Don't set Content-Type for FormData - let the browser set it with boundary
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
    'Authorization': `Bearer ${session.access_token}`,
  };

  // Make the request with the token
  return fetch(url, {
    ...options,
    headers,
  });
};

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: (url: string, options?: RequestInit) =>
    authenticatedFetch(url, { ...options, method: 'GET' }),
    
  post: (url: string, body?: any, options?: RequestInit) =>
    authenticatedFetch(url, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    }),
    
  put: (url: string, body?: any, options?: RequestInit) =>
    authenticatedFetch(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
    
  patch: (url: string, body?: any, options?: RequestInit) =>
    authenticatedFetch(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
    
  delete: (url: string, options?: RequestInit) =>
    authenticatedFetch(url, { ...options, method: 'DELETE' }),
};

/**
 * Helper to get just the token if you need it for other purposes
 */
export const getAuthToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};