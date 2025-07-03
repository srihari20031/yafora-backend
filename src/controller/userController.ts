import { Request, Response } from 'express';
import { signUpUser, signInUser } from '../services/userService';

export async function signUp(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, role } = req.body;
  
  // Debug logging
  console.log('SignUp request headers:', {
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer')
  });
  
  // Validate required fields
  if (!email || !password || !fullName || !role) {
    res.status(400).json({
      error: 'Missing required fields',
      details: 'Email, password, full name, and role are required'
    });
    return;
  }
  
  try {
    const result = await signUpUser(email, password, fullName, role);
    
    console.log('SignUp result from service:', {
      hasUser: !!result.user,
      hasSession: !!result.session,
      userConfirmed: result.user?.email_confirmed_at ? true : false
    });
    
    // CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin'));
    
    // Case 1: User created but no session (email confirmation required)
    if (result.user && !result.session) {
      console.log('✅ User created successfully - email confirmation required');
      res.status(201).json({
        success: true,
        message: 'Account created successfully. Please check your email to confirm your account before signing in.',
        user: {
          id: result.user.id,
          email: result.user.email,
          email_confirmed: false
        },
        requiresConfirmation: true,
        debug: {
          environment: process.env.NODE_ENV,
          origin: req.get('Origin')
        }
      });
      return;
    }
    
    // Case 2: User created with session (auto-confirm enabled or email already confirmed)
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
          expires_at: result.session.expires_at
        },
        debug: {
          environment: process.env.NODE_ENV,
          origin: req.get('Origin')
        }
      });
      return;
    }
    
    // Case 3: Unexpected state
    console.error('❌ Unexpected signup state:', result);
    res.status(500).json({ 
      error: 'Unexpected signup state',
      details: 'User creation status unclear'
    });
    
  } catch (err) {
    console.error('💥 Signup error:', err);
    
    const error = err as Error;
    
    // Handle specific Supabase errors
    if (error.message.includes('already registered') || error.message.includes('User already registered')) {
      res.status(409).json({
        error: 'Email already registered',
        details: 'An account with this email already exists'
      });
      return;
    }
    
    if (error.message.includes('Password')) {
      res.status(400).json({
        error: 'Invalid password',
        details: error.message
      });
      return;
    }
    
    if (error.message.includes('Email') || error.message.includes('email')) {
      res.status(400).json({
        error: 'Invalid email',
        details: error.message
      });
      return;
    }
    
    if (error.message.includes('Invalid role')) {
      res.status(400).json({
        error: 'Invalid role',
        details: 'Role must be buyer, seller, or admin'
      });
      return;
    }

    res.status(400).json({ 
      error: 'Signup failed',
      details: error.message 
    });
  }
}

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

// Test endpoint for debugging
export async function testTokens(req: Request, res: Response): Promise<void> {
  console.log('Test tokens endpoint called');
  console.log('Request origin:', req.get('Origin'));
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  // CORS headers
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.get('Origin'));
  
  res.json({
    success: true,
    message: 'Test endpoint working',
    environment: process.env.NODE_ENV,
    origin: req.get('Origin'),
    timestamp: new Date().toISOString()
  });
}