import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddlware';
import {
  getSellerOrders,
  updateSellerOrderDeliveryStatus,
  refundSecurityDeposit,
  reportSellerOrderDamage as reportSellerOrderDamageService,
  cancelSellerOrder as cancelSellerOrderService,
  getSellerTotalTransactions,
  getSellerReviews,
  acceptSellerOrder,
  rejectSellerOrder,
  getSellerPendingOrders,
  getSellerStats,
  getSellerOrderById as getSellerOrderByIdService
} from '../services/sellerOrderService';

export async function getSellerOrdersList(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const result = await getSellerOrders(sellerId, Number(page), Number(limit));
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function updateSellerOrderDelivery(req: Request, res: Response): Promise<void> {
  const { orderId } = req.params;
  const { status, sellerId } = req.body;

  try {
    const updatedOrder = await updateSellerOrderDeliveryStatus(orderId, status, sellerId);
    res.status(200).json({ 
      message: 'Delivery status updated successfully', 
      order: updatedOrder 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function refundSecurityDepositController(req: Request, res: Response): Promise<void> {
  const { orderId } = req.params;
  const { sellerId } = req.body;

  try {
    const updatedOrder = await refundSecurityDeposit(orderId, sellerId);
    res.status(200).json({ 
      message: 'Security deposit refunded successfully', 
      order: updatedOrder 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function reportSellerOrderDamage(req: Request, res: Response): Promise<void> {
  const { orderId } = req.params;
  const { description, photos, sellerId } = req.body;

  try {
    const updatedOrder = await reportSellerOrderDamageService(orderId, description, photos, sellerId);
    res.status(200).json({ 
      message: 'Damage reported successfully', 
      order: updatedOrder 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function cancelSellerOrder(req: Request, res: Response): Promise<void> {
  const { orderId } = req.params;
  const { reason, sellerId } = req.body;

  try {
    const cancelledOrder = await cancelSellerOrderService(orderId, reason, sellerId);
    res.status(200).json({ 
      message: 'Order cancelled successfully', 
      order: cancelledOrder 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getSellerTotalTransactionsController(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;

  try {
    const totals = await getSellerTotalTransactions(sellerId);
    res.status(200).json({ 
      message: 'Total transactions retrieved successfully', 
      totals 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getSellerStatsController(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;

  try {
    const stats = await getSellerStats(sellerId);
    res.status(200).json({ 
      message: 'Seller stats retrieved successfully', 
      stats 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getSellerReviewsList(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const result = await getSellerReviews(
      sellerId, 
      Number(page), 
      Number(limit)
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      error: (err as Error).message
    });
  }
}

export const acceptOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user?.id; // Assuming you have auth middleware

    if (!sellerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const order = await acceptSellerOrder(orderId, sellerId);

    res.status(200).json({
      success: true,
      message: 'Order confirmed successfully',
      data: order
    });
  } catch (error: any) {
    console.error('Error accepting order:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to accept order'
    });
  }
};

export const rejectOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const sellerId = req.user?.id;

    if (!sellerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!reason || reason.trim() === '') {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    const order = await rejectSellerOrder(orderId, sellerId, reason);

    res.status(200).json({
      success: true,
      message: 'Order rejected successfully',
      data: order
    });
  } catch (error: any) {
    console.error('Error rejecting order:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reject order'
    });
  }
};

export const getPendingOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orders = await getSellerPendingOrders(sellerId);

    res.status(200).json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error: any) {
    console.error('Error fetching pending orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch pending orders'
    });
  }
};

export const getOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user?.id;
    const { status } = req.query;

    if (!sellerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orders = await getSellerOrders(sellerId, 1, 50, status as string);

    res.status(200).json({
      success: true,
      data: orders.rentals,
      count: orders.total
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch orders'
    });
  }
};

export const getSellerOrderByIdController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user?.id;

    console.log('[getSellerOrderByIdController] Order ID:', orderId);
    console.log('[getSellerOrderByIdController] Seller ID from req.user:', sellerId);
    console.log('[getSellerOrderByIdController] Full req.user:', req.user);

    if (!sellerId) {
      console.log('[getSellerOrderByIdController] No seller ID - returning 401');
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const order = await getSellerOrderByIdService(orderId, sellerId);

    console.log('[getSellerOrderByIdController] Order fetched successfully');
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error: any) {
    console.error('[getSellerOrderByIdController] Error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch order details'
    });
  }
};