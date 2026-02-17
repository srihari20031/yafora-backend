// services/userService.ts

import supabaseDB from "../../config/connectDB";
import { processReferralSignup } from "./promoCodeAndReferral";

// ================================
// GENERATE REFERRAL CODE
// ================================
function generateReferralCode(): string {
  const prefix = 'REF';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix + timestamp + random;
}

// ================================
// CHECK IF REFERRAL CODE EXISTS
// ================================
async function isReferralCodeUnique(code: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseDB
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .single();
    
    return error !== null; // If error, code doesn't exist (unique)
  } catch {
    return true; // Assume unique if check fails
  }
}

// ================================
// GENERATE UNIQUE REFERRAL CODE
// ================================
async function generateUniqueReferralCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const code = generateReferralCode();
    const isUnique = await isReferralCodeUnique(code);
    
    if (isUnique) {
      return code;
    }
    
    attempts++;
  }
  
  // Fallback: use timestamp-based code
  return 'REF' + Date.now().toString(36).toUpperCase();
}

export async function signUpUser(
  email: string,
  password: string,
  fullName: string,
  role: string,
  phoneNumber?: string,
  whatsappNotifications?: boolean,
  emailNotifications?: boolean,
  referralCode?: string
) {
  console.log('🔍 Signup called with referralCode:', referralCode);
  const lowercaseRole = role.toLowerCase();

  if (!['buyer', 'seller'].includes(lowercaseRole)) {
    throw new Error('Invalid role. Must be buyer or seller.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Enhanced password validation
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  
  if (!/(?=.*\d)/.test(password)) {
    throw new Error('Password must contain at least one number');
  }
  
  if (!/(?=.*[@$!%*?&])/.test(password)) {
    throw new Error('Password must contain at least one special character (@$!%*?&)');
  }

  if (phoneNumber && !/^\+?\d{10,15}$/.test(phoneNumber)) {
    throw new Error('Invalid phone number format');
  }
  
  const normalizedEmail = email.toLowerCase().trim();

  // ✅ CRITICAL FIX: Check for existing profile BEFORE attempting signup
  console.log('Checking if email already exists in profiles...');
  const { data: existingProfile, error: profileCheckError } = await supabaseDB
    .from('profiles')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    console.error('❌ Email already exists in profiles:', normalizedEmail);
    throw new Error('An account with this email already exists');
  }

  // Also check in auth.users via admin API if available
  // This catches soft-deleted users that might not be in profiles
  try {
    const { data: authUsers, error: authError } = await supabaseDB.auth.admin.listUsers();
    
    if (!authError && authUsers?.users) {
      const existingAuthUser = authUsers.users.find(
        u => u.email?.toLowerCase() === normalizedEmail
      );
      
      if (existingAuthUser) {
        console.error('❌ Email exists in auth.users:', normalizedEmail);
        throw new Error('An account with this email already exists');
      }
    }
  } catch (adminError) {
    // Admin API might not be available, continue with regular signup
    console.warn('⚠️ Could not check auth.users:', adminError);
  }
  
  // Validate referral code if provided
  let referralValid = false;
  if (referralCode) {
    console.log('🔍 Validating referral code:', referralCode.trim());
    try {
      const { data: referrer, error } = await supabaseDB
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode.trim())
        .single();

      referralValid = !error && !!referrer;
      console.log('🔍 Referral code validation result:', { referralValid, referrer: referrer?.id, error: error?.message });
      if (!referralValid) {
        console.warn(`⚠️ Invalid referral code provided during signup: ${referralCode}`);
      }
    } catch (error) {
      console.warn(`⚠️ Error validating referral code: ${(error as Error).message}`);
    }
  }

  console.log('Starting user signup process...');

  try {
    console.log('🔍 Sending referral_code to Supabase auth:', referralCode?.trim());
    const { data, error } = await supabaseDB.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: lowercaseRole,
          phone_number: phoneNumber,
          whatsapp_notifications: whatsappNotifications ?? false,
          email_notifications: emailNotifications ?? true,
          referral_code: referralCode?.trim(),
        },
      },
    });

    // ✅ ENHANCED ERROR HANDLING
    if (error) {
      console.error('❌ Supabase signup error:', error);
      
      // Handle all variations of duplicate email errors
      if (
        error.message.includes('already registered') || 
        error.message.includes('User already registered') ||
        error.message.includes('already been registered') ||
        error.message.includes('duplicate') ||
        error.message.includes('unique') ||
        error.status === 422 ||
        error.code === '23505' // PostgreSQL unique violation
      ) {
        throw new Error('An account with this email already exists');
      }
      
      // Handle email not confirmed
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Please confirm your email before signing in');
      }
      
      // Generic error
      throw new Error(error.message || 'Signup failed');
    }

    // ✅ ENHANCED USER VALIDATION
    if (!data.user) {
      console.error('❌ No user returned from Supabase');
      throw new Error('Failed to create user account');
    }

    // ✅ ADDITIONAL CHECK: Verify this is a NEW user, not an existing one
    // Supabase sometimes returns existing users without error for duplicate signups
    if (data.user.created_at) {
      const createdTime = new Date(data.user.created_at).getTime();
      const now = Date.now();
      const timeDiff = now - createdTime;
      
      // If user was created more than 5 seconds ago, it's likely a duplicate
      if (timeDiff > 5000) {
        console.warn('⚠️ User was created earlier, possible duplicate:', {
          email: normalizedEmail,
          userId: data.user.id,
          createdAt: data.user.created_at,
          timeDiff
        });
        throw new Error('An account with this email already exists');
      }
    }

    // Double-check profile doesn't exist (race condition protection)
    const { data: doubleCheckProfile, error: doubleCheckError } = await supabaseDB
      .from('profiles')
      .select('id, email, created_at')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (doubleCheckProfile && !doubleCheckError) {
      // Check if profile was just created or existed before
      const profileCreatedTime = new Date(doubleCheckProfile.created_at).getTime();
      const now = Date.now();
      const profileAge = now - profileCreatedTime;
      
      if (profileAge > 5000) {
        console.error('❌ Profile already exists:', {
          email: normalizedEmail,
          profileId: doubleCheckProfile.id,
          createdAt: doubleCheckProfile.created_at,
          age: profileAge
        });
        throw new Error('An account with this email already exists');
      }
    }

    // Update or insert profile data
    console.log('✅ User created - updating/inserting profile');
    try {
      // Generate unique referral code for the new user
      const userReferralCode = await generateUniqueReferralCode();
      
      const { error: profileError } = await supabaseDB
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: fullName.trim(),
          role: lowercaseRole,
          phone_number: phoneNumber,
          whatsapp_notifications: whatsappNotifications ?? false,
          email_notifications: emailNotifications ?? true,
          is_kyc_verified: false,
          kyc_status: 'not_started',
          referral_code: userReferralCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id' // Only upsert based on ID, not email
        })
        .eq('id', data.user.id);

      if (profileError) {
        console.error('❌ Profile upsert error:', profileError);
        
        // If profile creation fails due to duplicate, clean up auth user
        if (profileError.code === '23505') {
          console.log('🧹 Cleaning up auth user due to duplicate profile...');
          try {
            await supabaseDB.auth.admin.deleteUser(data.user.id);
          } catch (cleanupError) {
            console.error('Failed to cleanup auth user:', cleanupError);
          }
          throw new Error('An account with this email already exists');
        }
        
        console.warn('⚠️ Profile upsert failed but continuing:', profileError.message);
      } else {
        console.log(`✅ Profile upsert successful - User referral code: ${userReferralCode}`);
        
        // Process referral if valid code was provided
        if (referralValid && referralCode) {
  console.log('🔍 Processing referral for new user:', data.user.id, 'with code:', referralCode.trim());
  await processReferralSignup(referralCode.trim(), data.user.id, normalizedEmail); // 🔑 pass email
}

        // Create default notification preferences
        try {
          await supabaseDB.from('notification_preferences').insert({
            user_id: data.user.id,
          });
          console.log('✅ Default notification preferences created for user:', data.user.id);
        } catch (prefsError) {
          console.warn('⚠️ Failed to create default notification preferences:', (prefsError as Error).message);
        }
      }
    } catch (profileError) {
      console.error('❌ Profile creation exception:', profileError);
      
      // Clean up auth user if profile creation fails
      console.log('🧹 Cleaning up auth user due to profile creation failure...');
      try {
        await supabaseDB.auth.admin.deleteUser(data.user.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }
      
      throw new Error('Failed to create user profile');
    }

    return {
      ...data,
      referralProcessed: referralValid && !!referralCode
    };
  } catch (error) {
    console.error('💥 SignUp service error:', error);
    throw error;
  }
}

// ================================
// SIGNIN FUNCTION
// ================================
export async function signInUser(email: string, password: string) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  try {
    const { data, error } = await supabaseDB.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
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

// ================================
// COMPLETE REFERRAL WHEN USER MAKES FIRST ACTION
// ================================
export async function completeReferralForUser(userId: string, actionType: string = 'first_purchase'): Promise<void> {
  try {
    // Find pending referral for this user
    const { data: referral, error: fetchError } = await supabaseDB
      .from('referrals')
      .select('*')
      .eq('referred_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch referral: ${fetchError.message}`);
    }

    if (!referral) {
      console.log('No pending referral found for user:', userId);
      return;
    }

    // Update referral status to completed
    const { error: updateError } = await supabaseDB
      .from('referrals')
      .update({ 
        status: 'completed',
        completion_action: actionType,
        completed_at: new Date().toISOString()
      })
      .eq('id', referral.id);

    if (updateError) {
      throw new Error(`Failed to complete referral: ${updateError.message}`);
    }

    // Create reward transaction for referrer
    const { error: rewardError } = await supabaseDB
      .from('user_rewards')
      .insert({
        user_id: referral.referrer_id,
        amount: referral.reward_amount,
        type: 'referral_bonus',
        description: `Referral bonus for ${actionType}`,
        related_user_id: userId,
        created_at: new Date().toISOString()
      });

    if (rewardError) {
      console.error('Failed to create reward record:', rewardError);
    }

    console.log(`✅ Referral completed! User ${referral.referrer_id} earned ₹${referral.reward_amount} from ${actionType}`);

  } catch (error) {
    console.error(`⚠️ Failed to complete referral: ${(error as Error).message}`);
  }
}

// ================================
// REQUEST PASSWORD RESET
// ================================
export async function requestPasswordReset(email: string) {
  if (!email) {
    throw new Error('Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  try {
    const { data, error } = await supabaseDB.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`
      }
    );

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('💥 Password reset request error:', error);
    throw error;
  }
}

// ================================
// RESET PASSWORD
// ================================
export async function resetPassword(token: string, newPassword: string) {
  if (!token || !newPassword) {
    throw new Error('Token and new password are required');
  }

  // Enhanced password validation
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  if (!/(?=.*[a-z])/.test(newPassword)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  
  if (!/(?=.*[A-Z])/.test(newPassword)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  
  if (!/(?=.*\d)/.test(newPassword)) {
    throw new Error('Password must contain at least one number');
  }
  
  if (!/(?=.*[@$!%*?&])/.test(newPassword)) {
    throw new Error('Password must contain at least one special character (@$!%*?&)');
  }

  try {
    // Set the session with the recovery token
    const { data: sessionData, error: sessionError } = await supabaseDB.auth.setSession({
      access_token: token,
      refresh_token: token
    });

    if (sessionError) {
      throw new Error('Invalid or expired reset token');
    }

    // Update the password
    const { data: updateData, error: updateError } = await supabaseDB.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw updateError;
    }

    return updateData;
  } catch (error) {
    console.error('💥 Password reset error:', error);
    throw error;
  }
}

// ================================
// GET USER REFERRAL STATS
// ================================
export async function getUserReferralStats(userId: string) {
  try {
    // Get user's referral code
    const { data: profile, error: profileError } = await supabaseDB
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch user profile');
    }

    // Get referral statistics
    const { data: referrals, error: referralsError } = await supabaseDB
      .from('referrals')
      .select(`
        *,
        referred_profile:profiles!referrals_referred_id_fkey(full_name, email)
      `)
      .eq('referrer_id', userId);

    if (referralsError) {
      throw new Error('Failed to fetch referral data');
    }

    // Calculate statistics
    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter(r => r.status === 'completed').length;
    const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
    const totalEarnings = referrals
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + r.reward_amount, 0);

    return {
      referralCode: profile.referral_code,
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalEarnings,
      referrals: referrals.map(r => ({
        id: r.id,
        referredUser: r.referred_profile?.full_name || 'Unknown',
        status: r.status,
        rewardAmount: r.reward_amount,
        createdAt: r.created_at,
        completedAt: r.completed_at
      }))
    };
  } catch (error) {
    console.error('💥 Get referral stats error:', error);
    throw error;
  }
}

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check in profiles table
    const { data: profile, error } = await supabaseDB
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's fine, means email doesn't exist
      console.error('Error checking email:', error);
      throw new Error('Failed to check email availability');
    }

    // If profile exists, email is taken
    if (profile) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('💥 Check email exists error:', error);
    throw error;
  }
}