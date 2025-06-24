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
  
  try {
    const result = await signUpUser(email, password, fullName, role);
    
    // Ensure we have tokens before sending response
    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.error('Session creation failed - no tokens received');
      res.status(400).json({ error: 'Failed to create session' });
      return;
    }
    
    console.log('Signup successful, sending tokens in response...');

    // CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin'));
    
    // Send tokens in the response body instead of cookies
    res.status(201).json({ 
      message: 'Signup successful', 
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
  } catch (err) {
    console.error('Signup error:', err);
    res.status(400).json({ error: (err as Error).message });
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

  try {
    const result = await signInUser(email, password);

    // Ensure we have tokens before sending response
    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.error('SignIn session creation failed - no tokens received');
      res.status(401).json({ error: 'Invalid credentials or session creation failed' });
      return;
    }

    console.log('Signin successful, sending tokens in response...');

    // CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin'));
    
    // Send tokens in the response body instead of cookies
    res.status(200).json({ 
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
    console.error('Signin error:', err);
    res.status(401).json({ error: (err as Error).message });
  }
}

export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    console.log('SignOut request received');
    
    // CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin'));

    res.status(200).json({ 
      message: 'Signout successful'
    });
  } catch (err) {
    console.error('Signout error:', err);
    res.status(500).json({ error: (err as Error).message });
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
    message: 'Test endpoint working',
    environment: process.env.NODE_ENV,
    origin: req.get('Origin'),
    timestamp: new Date().toISOString()
  });
}