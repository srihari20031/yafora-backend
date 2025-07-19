import { Request, Response } from 'express';
import {
  getSellerOrders,
  updateSellerOrderDeliveryStatus,
  reportSellerOrderDamage as reportSellerOrderDamageService,
  cancelSellerOrder as cancelSellerOrderService
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