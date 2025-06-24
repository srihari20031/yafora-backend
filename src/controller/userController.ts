import { Request, Response } from 'express';
import { signUpUser, signInUser } from '../services/userService';

// Helper function to get cookie options based on environment
const getCookieOptions = (maxAge: number) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    isProduction,
    userAgent: 'backend'
  });
  
  if (isProduction) {
    // Production settings - CRITICAL for cross-origin requests
    const options = {
      httpOnly: true,
      secure: true, // Requires HTTPS
      sameSite: 'none' as const, // CRITICAL: Allows cross-origin cookies
      maxAge: maxAge,
      path: '/',
      // DON'T set domain for Vercel deployments - let browser handle it
    };
    console.log('Production cookie options:', options);
    return options;
  } else {
    // Development settings - for same-origin requests (localhost)
    const options = {
      httpOnly: true,
      secure: false, // HTTP is fine for localhost
      sameSite: 'lax' as const, // More permissive for localhost
      maxAge: maxAge,
      path: '/',
    };
    console.log('Development cookie options:', options);
    return options;
  }
};

export async function signUp(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, role } = req.body;
  
  // Debug logging
  console.log('SignUp request headers:', {
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    cookie: req.get('Cookie'),
    referer: req.get('Referer')
  });
  
  try {
    const result = await signUpUser(email, password, fullName, role);
    
    // Ensure we have tokens before setting cookies
    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.error('Session creation failed - no tokens received');
      res.status(400).json({ error: 'Failed to create session' });
      return;
    }
    
    console.log('Setting cookies for signup...');
    const cookieOptions = getCookieOptions(60 * 60 * 1000);
    
    // Set cookies for access and refresh tokens
    res.cookie('sb-access-token', result.session.access_token, cookieOptions);
    res.cookie('sb-refresh-token', result.session.refresh_token, 
      getCookieOptions(30 * 24 * 60 * 60 * 1000) // 30 days
    );

    // CRITICAL: Ensure CORS headers are set correctly
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin')); // Echo back the origin
    
    console.log('Response headers before sending:', {
      'set-cookie': res.getHeaders()['set-cookie'],
      'access-control-allow-credentials': res.getHeaders()['access-control-allow-credentials'],
      'access-control-allow-origin': res.getHeaders()['access-control-allow-origin']
    });

    // Send response
    res.status(201).json({ 
      message: 'Signup successful', 
      user: result.user,
      session: result.session,
      debug: {
        cookiesSet: true,
        environment: process.env.NODE_ENV,
        origin: req.get('Origin'),
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
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
    cookie: req.get('Cookie'),
    referer: req.get('Referer')
  });

  try {
    const result = await signInUser(email, password);

    // Ensure we have tokens before setting cookies
    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.error('SignIn session creation failed - no tokens received');
      res.status(401).json({ error: 'Invalid credentials or session creation failed' });
      return;
    }

    console.log('Setting cookies for signin...');
    const cookieOptions = getCookieOptions(60 * 60 * 1000);

    // Use the same cookie options as signUp
    res.cookie('sb-access-token', result.session.access_token, cookieOptions);
    res.cookie('sb-refresh-token', result.session.refresh_token, 
      getCookieOptions(30 * 24 * 60 * 60 * 1000) // 30 days
    );

    // CRITICAL: Ensure CORS headers are set correctly
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.get('Origin')); // Echo back the origin
    
    console.log('Response headers before sending:', {
      'set-cookie': res.getHeaders()['set-cookie'],
      'access-control-allow-credentials': res.getHeaders()['access-control-allow-credentials'],
      'access-control-allow-origin': res.getHeaders()['access-control-allow-origin']
    });

    res.status(200).json({ 
      message: 'Signin successful', 
      user: result.session?.user,
      session: result.session,
      debug: {
        cookiesSet: true,
        environment: process.env.NODE_ENV,
        origin: req.get('Origin'),
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      }
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(401).json({ error: (err as Error).message });
  }
}

export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    
    console.log('SignOut - clearing cookies in production mode:', isProduction);
    
    const clearCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const, // CRITICAL: Must match original cookie
      path: '/',
      // Don't set domain for Vercel deployments
    };

    console.log('Clear cookie options:', clearCookieOptions);

    // Clear the authentication cookies
    res.clearCookie('sb-access-token', clearCookieOptions);
    res.clearCookie('sb-refresh-token', clearCookieOptions);

    // CRITICAL: Ensure CORS headers are set correctly
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

// Add a test endpoint to debug cookie setting
export async function testCookies(req: Request, res: Response): Promise<void> {
  console.log('Test cookies endpoint called');
  console.log('Request origin:', req.get('Origin'));
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Set a test cookie with proper cross-origin settings
  res.cookie('test-cookie', 'test-value', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const, // CRITICAL
    maxAge: 60 * 60 * 1000, // 1 hour
    path: '/',
  });
  
  // Ensure CORS headers
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.get('Origin'));
  
  res.json({
    message: 'Test cookie set',
    environment: process.env.NODE_ENV,
    isProduction,
    origin: req.get('Origin'),
    cookieSettings: {
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      httpOnly: true
    }
  });
}