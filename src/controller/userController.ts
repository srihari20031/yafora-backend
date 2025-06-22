import { Request, Response } from 'express';
import { signUpUser, signInUser } from '../services/userService';

// 🔥 FIXED: Cookie options for Render.com deployment
const getCookieOptions = (maxAge: number) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('🍪 Cookie environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    isProduction,
  });
  
  if (isProduction) {
    // Production settings for Render.com
    const options = {
      httpOnly: true,
      secure: true, // HTTPS required
      sameSite: 'none' as const, // Cross-origin required
      maxAge: maxAge,
      path: '/',
      // 🔥 CRITICAL: DON'T set domain for Render.com - let browser handle it
    };
    console.log('🍪 Production cookie options:', options);
    return options;
  } else {
    // Development settings
    const options = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      maxAge: maxAge,
      path: '/',
    };
    console.log('🍪 Development cookie options:', options);
    return options;
  }
};

export async function signUp(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, role } = req.body;
  
  console.log('📝 SignUp request:', {
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    cookie: req.get('Cookie'),
  });
  
  try {
    const result = await signUpUser(email, password, fullName, role);
    
    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.error('❌ Session creation failed - no tokens');
      res.status(400).json({ error: 'Failed to create session' });
      return;
    }
    
    console.log('🍪 Setting cookies for signup...');
    
    // 🔥 CRITICAL: Set cookies with proper options
    const accessCookieOptions = getCookieOptions(60 * 60 * 1000); // 1 hour
    const refreshCookieOptions = getCookieOptions(30 * 24 * 60 * 60 * 1000); // 30 days
    
    // Set the cookies
    res.cookie('sb-access-token', result.session.access_token, accessCookieOptions);
    res.cookie('sb-refresh-token', result.session.refresh_token, refreshCookieOptions);
    
    console.log('✅ Cookies set, sending response...');
    
    // Send response
    res.status(201).json({ 
      message: 'Signup successful', 
      user: result.user,
      // Don't send session tokens in response when using cookies
      debug: {
        cookiesSet: true,
        environment: process.env.NODE_ENV,
        origin: req.get('Origin'),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ Signup error:', err);
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  console.log('🔐 SignIn request:', {
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    cookie: req.get('Cookie'),
  });

  try {
    const result = await signInUser(email, password);

    if (!result.session?.access_token || !result.session?.refresh_token) {
      console.error('❌ SignIn failed - no tokens');
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    console.log('🍪 Setting cookies for signin...');
    
    // 🔥 CRITICAL: Set cookies with proper options
    const accessCookieOptions = getCookieOptions(60 * 60 * 1000); // 1 hour
    const refreshCookieOptions = getCookieOptions(30 * 24 * 60 * 60 * 1000); // 30 days
    
    // Set the cookies BEFORE sending response
    res.cookie('sb-access-token', result.session.access_token, accessCookieOptions);
    res.cookie('sb-refresh-token', result.session.refresh_token, refreshCookieOptions);
    
    console.log('✅ SignIn cookies set, sending response...');

    res.status(200).json({ 
      message: 'Signin successful', 
      user: result.session.user,
      // Don't send session in response when using cookies
      debug: {
        cookiesSet: true,
        environment: process.env.NODE_ENV,
        origin: req.get('Origin'),
        timestamp: new Date().toISOString(),
        cookieNames: ['sb-access-token', 'sb-refresh-token']
      }
    });
    
  } catch (err) {
    console.error('❌ Signin error:', err);
    res.status(401).json({ error: (err as Error).message });
  }
}

export async function signOut(req: Request, res: Response): Promise<void> {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    
    console.log('🚪 SignOut - clearing cookies in production:', isProduction);
    
    const clearCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: '/',
      // Don't set domain for Render.com
    };

    console.log('🍪 Clear cookie options:', clearCookieOptions);

    // Clear cookies
    res.clearCookie('sb-access-token', clearCookieOptions);
    res.clearCookie('sb-refresh-token', clearCookieOptions);

    res.status(200).json({ 
      message: 'Signout successful',
      debug: {
        cookiesCleared: true,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ Signout error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// Enhanced test endpoint
export async function testCookies(req: Request, res: Response): Promise<void> {
  console.log('🧪 Test cookies endpoint called');
  console.log('Request details:', {
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    existingCookies: req.get('Cookie')
  });
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  const testCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    maxAge: 60 * 60 * 1000, // 1 hour
    path: '/',
  };
  
  console.log('🍪 Setting test cookies with options:', testCookieOptions);
  
  // Set multiple test cookies
  res.cookie('test-cookie-1', 'value-1-' + Date.now(), testCookieOptions);
  res.cookie('test-cookie-2', 'value-2-' + Date.now(), testCookieOptions);
  res.cookie('sb-access-token', 'fake-token-' + Date.now(), testCookieOptions);
  
  res.json({
    message: 'Test cookies set successfully',
    cookieOptions: testCookieOptions,
    environment: process.env.NODE_ENV,
    isProduction,
    origin: req.get('Origin'),
    timestamp: new Date().toISOString(),
    cookiesSet: ['test-cookie-1', 'test-cookie-2', 'sb-access-token']
  });
}