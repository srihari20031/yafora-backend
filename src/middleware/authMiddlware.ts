import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side usage
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    full_name?: string;
    phone_number?: string;
  };
}

interface SupabaseUser {
  id: string;
  email: string;
  user_metadata?: any;
  app_metadata?: any;
}

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  role: string;
  is_kyc_verified: boolean;
  kyc_status: string;
  created_at: string;
}

// Middleware to verify Supabase JWT and authenticate user
export const authMiddleware = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[SupabaseAuthMiddleware] No token provided');
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[SupabaseAuthMiddleware] Token verification failed:', error?.message);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Fetch user profile from your profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[SupabaseAuthMiddleware] Profile fetch failed:', profileError?.message);
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email!,
      role: profile.role,
      full_name: profile.full_name,
      phone_number: profile.phone_number,
    };

    next();
  } catch (error) {
    console.error('[SupabaseAuthMiddleware] Unexpected error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to check for admin role
export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {    
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      console.warn('[AdminMiddleware] Access denied. User role:', req.user.role);
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('[AdminMiddleware] Error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

// Middleware to check for specific roles
export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        console.warn('[RoleMiddleware] Access denied for role:', req.user.role);
        res.status(403).json({
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[RoleMiddleware] Error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

// Middleware to check if user is the owner of a resource or an admin
export const ownershipMiddleware = (userIdParam: string = 'userId') => {
  interface OwnershipRequest extends AuthenticatedRequest {
    params: {
      [key: string]: string;
    };
  }

  type OwnershipMiddleware = (req: OwnershipRequest, res: Response, next: NextFunction) => void;

  const middleware: OwnershipMiddleware = (req, res, next): void => {
    try {
      const resourceUserId = req.params[userIdParam];

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Admins can access all
      if (req.user.role === 'admin') {
        return next();
      }

      // User can access only their own resources
      if (req.user.id !== resourceUserId) {
        console.warn(`[OwnershipMiddleware] Access denied. User ID: ${req.user.id}, Resource User ID: ${resourceUserId}`);
        res.status(403).json({ error: 'Access denied: You can only access your own resources' });
        return;
      }

      next();
    } catch (error) {
      console.error('[OwnershipMiddleware] Error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };

  return middleware;
};
export const deliveryPartnerMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'delivery_partner') {
      console.warn('[DeliveryPartnerMiddleware] Access denied. User role:', req.user.role);
      res.status(403).json({ error: 'Delivery partner access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('[DeliveryPartnerMiddleware] Error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};