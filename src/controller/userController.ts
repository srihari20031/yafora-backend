import { Request, Response } from 'express';
import { signUpUser, signInUser } from '../services/userService';

export async function signUp(req: Request, res: Response): Promise<void> {
  const { email, password, fullName, role } = req.body;
  try {
    const result = await signUpUser(email, password, fullName, role);
    // Set cookies for access and refresh tokens
    res.cookie('sb-access-token', result.session?.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    });
   
    
    res.cookie('sb-refresh-token', result.session?.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });


    res.status(201).json({ 
      message: 'Signup successful', 
      user: result.user,
      session: result.session
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  try {
    const result = await signInUser(email, password);

    res.cookie('sb-access-token', result.session?.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
      path: '/',
    });
 
    
    res.cookie('sb-refresh-token', result.session?.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });


    res.status(200).json({ 
      message: 'Signin successful', 
      user: result.session?.user,
      session: result.session
    });
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
}