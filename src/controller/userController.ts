// src/controller/userController.ts - Updated cookie configuration

import { Request, Response } from 'express';
import { signUpUser, signInUser } from '../services/userService';

// Helper function to get cookie options based on environment
const getCookieOptions = (maxAge: number) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production settings - for cross-origin requests
    return {
      httpOnly: true,
      secure: true, // Requires HTTPS
      sameSite: 'none' as const, // Required for cross-origin
      maxAge: maxAge,
      path: '/',
      // Add domain if both frontend and backend are on same root domain
      // domain: process.env.COOKIE_DOMAIN, // e.g., '.yourdomain.com'
    };
  } else {
    // Development settings - for same-origin requests
    return {
      httpOnly: true,
      secure: false, // HTTP is fine for localhost
      sameSite: 'lax' as const, // Works for same-origin
      maxAge: maxAge,
      path: '/',
    };
  }
};

export async function signUp(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, role } = req.body;
  try {
    const result = await signUpUser(email, password, fullName, role);
    
    if (!result.session?.access_token || !result.session?.refresh_token) {
      res.status(400).json({ error: 'Failed to create session' });
      return;
    }
    
    // Set cookies with proper configuration
    const cookieOptions = getCookieOptions(60 * 60 * 1000); // 1 hour
    const refreshCookieOptions = getCookieOptions(30 * 24 * 60 * 60 * 1000); // 30 days
    
    res.cookie('sb-access-token', result.session.access_token, cookieOptions);
    res.cookie('sb-refresh-token', result.session.refresh_token, refreshCookieOptions);

    // IMPORTANT: Add explicit CORS headers for cookies
    if (process.env.NODE_ENV === 'production') {
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Origin', req.headers.origin);
    }

    res.status(201).json({ 
      message: 'Signup successful', 
      user: result.user,
      session: result.session
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  try {
    const result = await signInUser(email, password);

    if (!result.session?.access_token || !result.session?.refresh_token) {
      res.status(401).json({ error: 'Invalid credentials or session creation failed' });
      return;
    }

    const cookieOptions = getCookieOptions(60 * 60 * 1000); // 1 hour
    const refreshCookieOptions = getCookieOptions(30 * 24 * 60 * 60 * 1000); // 30 days
    
    res.cookie('sb-access-token', result.session.access_token, cookieOptions);
    res.cookie('sb-refresh-token', result.session.refresh_token, refreshCookieOptions);

    // IMPORTANT: Add explicit CORS headers for cookies
    if (process.env.NODE_ENV === 'production') {
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Origin', req.headers.origin);
    }

    res.status(200).json({ 
      message: 'Signin successful', 
      user: result.session?.user,
      session: result.session
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(401).json({ error: (err as Error).message });
  }
}

export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const clearCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: '/',
    };

    res.clearCookie('sb-access-token', clearCookieOptions);
    res.clearCookie('sb-refresh-token', clearCookieOptions);

    if (isProduction) {
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Origin', req.headers.origin);
    }

    res.status(200).json({ 
      message: 'Signout successful'
    });
  } catch (err) {
    console.error('Signout error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
}