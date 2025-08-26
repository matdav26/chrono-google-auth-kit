import { supabase } from '@/integrations/supabase/client';

/**
 * Checks if a user has signed up through email/password by checking their signup_method
 * @param userId - The user's ID from auth
 * @returns true if user signed up with email, false otherwise
 */
export async function checkUserSignedUpWithEmail(userId: string): Promise<boolean> {
  try {
    console.log('Checking user signup method for:', userId);
    
    // Check if user exists and how they signed up
    const { data, error } = await supabase
      .from('users')
      .select('id, signup_method')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.log('User not found in database:', error.message);
      return false;
    }
    
    console.log('User data found:', data);
    // Check if user signed up with email
    return data?.signup_method === 'email';
  } catch (error) {
    console.error('Error checking user signup method:', error);
    return false;
  }
}

/**
 * Validates Google OAuth login - ensures user signed up with email/password first
 * @param userId - The user's ID from auth
 * @returns Object with isValid flag and optional error message
 */
export async function validateGoogleOAuthLogin(userId: string): Promise<{
  isValid: boolean;
  errorMessage?: string;
}> {
  const signedUpWithEmail = await checkUserSignedUpWithEmail(userId);
  
  if (!signedUpWithEmail) {
    return {
      isValid: false,
      errorMessage: 'Please sign up with email and password before using Google login.'
    };
  }
  
  return { isValid: true };
}

/**
 * Handles the Google OAuth validation flow
 * Signs out the user and returns error info if validation fails
 */
export async function handleGoogleOAuthValidation(userId: string): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const validation = await validateGoogleOAuthLogin(userId);
  
  if (!validation.isValid) {
    console.log('Google OAuth validation failed, signing out user');
    await supabase.auth.signOut();
    
    return {
      success: false,
      errorMessage: validation.errorMessage
    };
  }
  
  return { success: true };
}