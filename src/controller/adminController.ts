import { Request, Response } from 'express';
import * as AdminService from '../services/adminService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
  };
}

export async function getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await AdminService.getAllUsers();
    console.log('Fetched users:', users.length, 'users found');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await AdminService.getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const updatedUser = await AdminService.updateUserStatus(userId, status);

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getAllProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const products = await AdminService.getAllProducts();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateProductStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const { status } = req.body;

    const updatedProduct = await AdminService.updateProductStatus(productId, status);

    if (!updatedProduct) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getAllOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const orders = await AdminService.getAllOrders();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const updatedOrder = await AdminService.updateOrderStatus(orderId, status);

    if (!updatedOrder) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function applyLateFee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Valid amount is required' });
      return;
    }

    const updatedOrder = await AdminService.applyLateFee(orderId, amount);

    if (!updatedOrder) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function handleDamageClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { action, amount } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Valid action (approve/reject) is required' });
      return;
    }

    if (action === 'approve' && (!amount || amount <= 0)) {
      res.status(400).json({ error: 'Valid amount is required for approval' });
      return;
    }

    const updatedOrder = await AdminService.handleDamageClaim(orderId, { action, amount });

    if (!updatedOrder) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getSellerEarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sellerId } = req.params;
    const earnings = await AdminService.getSellerEarnings(sellerId);
    res.status(200).json(earnings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updatePlatformCommission(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const { commission } = req.body;

    if (commission === undefined || commission < 0 || commission > 100) {
      res.status(400).json({ error: 'Valid commission percentage (0-100) is required' });
      return;
    }

    const updatedProduct = await AdminService.updatePlatformCommission(productId, commission);

    if (!updatedProduct) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getSecurityDeposits(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const deposits = await AdminService.getSecurityDeposits();
    res.status(200).json(deposits);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function processWithdrawalRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    if (!status || !['processing', 'paid'].includes(status)) {
      res.status(400).json({ error: 'Valid status (processing/paid) is required' });
      return;
    }

    const updatedPayment = await AdminService.processWithdrawalRequest(paymentId, status);

    if (!updatedPayment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.status(200).json(updatedPayment);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function manageReferralProgram(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { action, referralId, referralData } = req.body;

    if (!action || !['create', 'update'].includes(action)) {
      res.status(400).json({ error: 'Valid action (create/update) is required' });
      return;
    }

    if (action === 'update' && !referralId) {
      res.status(400).json({ error: 'Referral ID is required for update' });
      return;
    }

    if (!referralData) {
      res.status(400).json({ error: 'Referral data is required' });
      return;
    }

    const result = await AdminService.manageReferralProgram(action, referralId, referralData);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function managePromoCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { action, promoData } = req.body;

    if (!action || !['create', 'update'].includes(action)) {
      res.status(400).json({ error: 'Valid action (create/update) is required' });
      return;
    }

    if (!promoData) {
      res.status(400).json({ error: 'Promo data is required' });
      return;
    }

    const result = await AdminService.managePromoCode(action, promoData);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function assignDelivery(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId, deliveryPartnerId } = req.body;

    if (!orderId || !deliveryPartnerId) {
      res.status(400).json({ error: 'Order ID and delivery partner ID are required' });
      return;
    }

    const updatedOrder = await AdminService.assignDelivery(orderId, deliveryPartnerId);

    if (!updatedOrder) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getMissedPickups(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const missedPickups = await AdminService.getMissedPickups();
    res.status(200).json(missedPickups);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}