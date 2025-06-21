import { Request, Response } from 'express';
import { signUpUser, signInUser } from '../services/userService';

// Helper function to get cookie options for Vercel deployment
const getCookieOptions = (maxAge: number) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Vercel production settings - both apps on vercel.app domain
    return {
      httpOnly: true,
      secure: true, // Always true for HTTPS (Vercel uses HTTPS)
      sameSite: 'lax' as const, // Use 'lax' instead of 'none' for same-site
      maxAge: maxAge,
      path: '/',
      // DO NOT set domain for Vercel - let it default to the current domain
      // This prevents cross-subdomain issues
    };
  } else {
    // Development settings
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      maxAge: maxAge,
      path: '/',
    };
  }
};

export async function signUp(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, role } = req.body;
  
  try {
    console.log('Signup attempt - Email:', email, 'Role:', role);
    const result = await signUpUser(email, password, fullName, role);
    console.log('Signup result:', result);

    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.log('Signup failed - No session tokens');
      res.status(400).json({ error: 'Session creation failed' });
      return;
    }
    
    // Set cookies for access and refresh tokens
    const cookieOptions = getCookieOptions(60 * 60 * 1000); // 1 hour
    res.cookie('sb-access-token', result.session.access_token, cookieOptions);
    console.log('Set sb-access-token:', result.session.access_token.substring(0, 10) + '...', 'Options:', cookieOptions);

    res.cookie('sb-refresh-token', result.session.refresh_token, getCookieOptions(30 * 24 * 60 * 60 * 1000)); // 30 days
    console.log('Set sb-refresh-token:', result.session.refresh_token.substring(0, 10) + '...', 'Options:', getCookieOptions(30 * 24 * 60 * 60 * 1000));

    // For Vercel, add cache control headers to prevent caching of auth responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(201).json({ 
      message: 'Signup successful', 
      user: result.user,
      session: result.session,
      cookiesSet: true
    });
    
  } catch (err) {
    console.error('Signup error:', (err as Error).message);
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  try {
    console.log('Signin attempt - Email:', email);
    const result = await signInUser(email, password);
    console.log('Signin result:', result);

    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.log('Signin failed - No session tokens');
      res.status(401).json({ error: 'Authentication failed - no session' });
      return;
    }

    // Set cookies
    const cookieOptions = getCookieOptions(60 * 60 * 1000); // 1 hour
    res.cookie('sb-access-token', result.session.access_token, cookieOptions);
    console.log('Set sb-access-token:', result.session.access_token.substring(0, 10) + '...', 'Options:', cookieOptions);

    res.cookie('sb-refresh-token', result.session.refresh_token, getCookieOptions(30 * 24 * 60 * 60 * 1000)); // 30 days
    console.log('Set sb-refresh-token:', result.session.refresh_token.substring(0, 10) + '...', 'Options:', getCookieOptions(30 * 24 * 60 * 60 * 1000));

    // For Vercel, add cache control headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json({ 
      message: 'Signin successful', 
      user: result.session?.user,
      session: result.session,
      cookiesSet: true
    });
    
  } catch (err) {
    console.error('Signin error:', (err as Error).message);
    res.status(401).json({ error: (err as Error).message });
  }
}

export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    console.log('Signout attempt');
    const isProduction = process.env.NODE_ENV === 'production';
    
    const clearCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      // No domain specified for Vercel
    };

    console.log('Clearing sb-access-token and sb-refresh-token');
    res.clearCookie('sb-access-token', clearCookieOptions);
    res.clearCookie('sb-refresh-token', clearCookieOptions);

    // Add cache control headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json({ 
      message: 'Signout successful'
    });
  } catch (err) {
    console.error('Signout error:', (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
}