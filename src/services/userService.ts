import supabaseDB from "../../config/connectDB";

export async function signUpUser(email: string, password: string, fullName: string, role: string) {
  const lowercaseRole = role.toLowerCase();
  
  // Validate role
  if (!['buyer', 'seller', 'admin'].includes(lowercaseRole)) {
    throw new Error('Invalid role. Must be buyer, seller, or admin.');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password strength (optional - adjust as needed)
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  try {
    const { data, error } = await supabaseDB.auth.signUp({
      email: email.toLowerCase().trim(), // Normalize email
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: lowercaseRole,
        }
      }
    });

    console.log('SignUp Data:', {
      user: data.user ? { id: data.user.id, email: data.user.email, confirmed: !!data.user.email_confirmed_at } : null,
      session: data.session ? 'Present' : 'Null',
      error: error ? error.message : 'None'
    });

    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('already registered')) {
        throw new Error('An account with this email already exists');
      }
      throw new Error(error.message);
    }

    // If we have both user and session (auto-confirm enabled), update profile
    if (data.user && data.session) {
      console.log('✅ User created with session - updating profile');
      
      try {
        const { error: profileError } = await supabaseDB
          .from("profiles")
          .update({
            full_name: fullName.trim(),
            role: lowercaseRole,
          })
          .eq("id", data.user.id);

        if (profileError) {
          console.warn('⚠️ Profile update error (non-critical):', profileError);
          // Don't throw here as the user was created successfully
        }
      } catch (profileError) {
        console.warn('⚠️ Profile update exception (non-critical):', profileError);
      }
    }

    return data;
  } catch (error) {
    console.error('💥 SignUp service error:', error);
    throw error;
  }
}

export async function signInUser(email: string, password: string) {
  // Validate inputs
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  try {
    const { data, error } = await supabaseDB.auth.signInWithPassword({
      email: email.toLowerCase().trim(), // Normalize email
      password,
    });

    console.log('SignIn Data:', {
      user: data.user ? { id: data.user.id, email: data.user.email, confirmed: !!data.user.email_confirmed_at } : null,
      session: data.session ? 'Present' : 'Null',
      error: error ? error.message : 'None'
    });

    if (error) {
      // Handle specific sign-in errors
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Please confirm your email before signing in');
      }
      throw new Error(error.message);
    }

    if (!data.session) {
      throw new Error('Failed to create session. Please try again.');
    }

    return data;
  } catch (error) {
    console.error('💥 SignIn service error:', error);
    throw error;
  }
}