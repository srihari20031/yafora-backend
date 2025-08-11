import { Request, Response } from 'express';
import { 
  signUpUser, 
  signInUser, 
  completeReferralForUser 
} from '../services/userService';

export async function signUp(req: Request, res: Response): Promise<void> {
  const { 
    email, 
    password, 
    fullName, 
    role, 
    phoneNumber, 
    whatsappNotifications, 
    emailNotifications,
    referralCode // New field for referral code
  } = req.body;

  console.log("Request body: ", req.body);

  if (!email || !password || !fullName || !role) {
    res.status(400).json({
      error: 'Missing required fields',
      details: 'Email, password, full name, and role are required',
    });
    return;
  }

  console.log("Signup details:", {
    email, 
    fullName, 
    role, 
    phoneNumber, 
    whatsappNotifications, 
    emailNotifications,
    hasReferralCode: !!referralCode
  });

  try {
    const result = await signUpUser(
      email, 
      password, 
      fullName, 
      role, 
      phoneNumber, 
      whatsappNotifications, 
      emailNotifications,
      referralCode // Pass referral code to service
    );

    console.log('SignUp result from service:', {
      hasUser: !!result.user,
      hasSession: !!result.session,
      userConfirmed: result.user?.email_confirmed_at ? true : false,
      referralProcessed: result.referralProcessed
    });

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin'));

    if (result.user && !result.session) {
      console.log('✅ User created successfully - email confirmation required');
      res.status(201).json({
        success: true,
        message: 'Account created successfully. Please check your email to confirm your account before signing in.',
        user: {
          id: result.user.id,
          email: result.user.email,
          email_confirmed: false,
        },
        requiresConfirmation: true,
        referralProcessed: result.referralProcessed,
        referralMessage: result.referralProcessed ? 
          'Your referral has been recorded! Your referrer will receive rewards when you complete your first action.' : 
          undefined
      });
      return;
    }

    if (result.user && result.session?.access_token && result.session?.refresh_token) {
      console.log('✅ User created with session - sending tokens');
      res.status(201).json({
        success: true,
        message: 'Account created and signed in successfully',
        user: result.user,
        session: result.session,
        tokens: {
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
          expires_at: result.session.expires_at,
        },
        referralProcessed: result.referralProcessed,
        referralMessage: result.referralProcessed ? 
          'Welcome! Your referrer will receive rewards when you complete your first action.' : 
          undefined
      });
      return;
    }

    console.error('❌ Unexpected signup state:', result);
    res.status(500).json({
      error: 'Unexpected signup state',
      details: 'User creation status unclear',
    });
  } catch (err) {
    console.error('💥 Signup error:', err);
    const error = err as Error;
    if (error.message.includes('already registered')) {
      res.status(409).json({
        error: 'Email already registered',
        details: 'An account with this email already exists',
      });
      return;
    }
    res.status(400).json({
      error: 'Signup failed',
      details: error.message,
    });
  }
}

// ================================
// SIGNIN CONTROLLER (No changes)
// ================================
export async function signIn(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  // Debug logging
  console.log('SignIn request headers:', {
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer')
  });

  // Validate required fields
  if (!email || !password) {
    res.status(400).json({
      error: 'Missing required fields',
      details: 'Email and password are required'
    });
    return;
  }

  try {
    const result = await signInUser(email, password);

    console.log('SignIn result from service:', {
      hasUser: !!result.user,
      hasSession: !!result.session,
      userConfirmed: result.user?.email_confirmed_at ? true : false
    });

    // Ensure we have tokens before sending response
    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.error('❌ SignIn session creation failed - no tokens received');
      res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid credentials or email not confirmed'
      });
      return;
    }

    console.log('✅ Signin successful, sending tokens in response...');

    // CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin'));
    
    // Send tokens in the response body
    res.status(200).json({ 
      success: true,
      message: 'Signin successful', 
      user: result.session?.user,
      session: result.session,
      tokens: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_at: result.session.expires_at
      },
      debug: {
        environment: process.env.NODE_ENV,
        origin: req.get('Origin')
      }
    });
  } catch (err) {
    console.error('💥 Signin error:', err);
    
    const error = err as Error;
    
    // Handle specific authentication errors
    if (error.message.includes('Invalid login credentials') || 
        error.message.includes('Email not confirmed')) {
      res.status(401).json({
        error: 'Authentication failed',
        details: error.message.includes('Email not confirmed') 
          ? 'Please confirm your email before signing in'
          : 'Invalid email or password'
      });
      return;
    }
    
    res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
}

// ================================
// SIGNOUT CONTROLLER (No changes)
// ================================
export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    console.log('SignOut request received');
    
    // CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin'));

    res.status(200).json({ 
      success: true,
      message: 'Signout successful'
    });
  } catch (err) {
    console.error('Signout error:', err);
    res.status(500).json({ 
      error: 'Signout failed',
      details: (err as Error).message 
    });
  }
}

// ================================
// COMPLETE REFERRAL CONTROLLER
// ================================
export async function completeReferralController(req: Request, res: Response): Promise<void> {
  try {
    const { userId, actionType = 'first_purchase' } = req.body;

    if (!userId) {
      res.status(400).json({
        error: 'Missing required field',
        details: 'User ID is required'
      });
      return;
    }

    await completeReferralForUser(userId, actionType);

    res.status(200).json({
      success: true,
      message: 'Referral completion processed successfully'
    });
  } catch (error) {
    console.error('💥 Error completing referral:', error);
    res.status(500).json({
      error: 'Failed to complete referral',
      details: (error as Error).message
    });
  }
}