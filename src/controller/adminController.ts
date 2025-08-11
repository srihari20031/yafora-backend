import { Request, Response } from 'express';
import * as AdminService from '../services/adminService';
import { NotificationHelpers, NotificationTriggers } from '../../utils/notificationTriggers';

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
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    const user = await AdminService.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!userId || !status) {
      res.status(400).json({ error: 'User ID and status are required' });
      return;
    }
    if (!['suspicious', 'inactive', 'verified'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const updatedUser = await AdminService.updateUserStatus(userId, status);
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user status:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getAllProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const products = await AdminService.getAllProducts();
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateProductStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const { status } = req.body;
    if (!productId || !status) {
      res.status(400).json({ error: 'Product ID and status are required' });
      return;
    }
    if (!['visible', 'hidden', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const updatedProduct = await AdminService.updateProductStatus(productId, status);
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product status:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getAllOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const orders = await AdminService.getAllOrders();
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    if (!orderId || !status) {
      res.status(400).json({ error: 'Order ID and status are required' });
      return;
    }
    if (!['pending', 'accepted', 'out_for_pickup', 'picked', 'delivered', 'returned', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const updatedOrder = await AdminService.updateOrderStatus(orderId, status);
    
    // Trigger notifications based on status change
    await NotificationHelpers.handleOrderStatusUpdate(orderId, status, {
      sellerId: updatedOrder.seller_id,
      buyerId: updatedOrder.buyer_id,
      productName: updatedOrder.product_name,
      buyerName: updatedOrder.buyer_name,
      rentalDate: updatedOrder.rental_date,
      deliveryMethod: updatedOrder.delivery_method,
      amount: updatedOrder.total_amount
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function applyLateFee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { amount } = req.body;
    if (!orderId || !amount || amount <= 0) {
      res.status(400).json({ error: 'Order ID and valid amount are required' });
      return;
    }

    const updatedOrder = await AdminService.applyLateFee(orderId, amount);
    
    // Trigger late fee notifications
    await NotificationHelpers.handleLateFeeApplication(orderId, amount, {
      buyerId: updatedOrder.buyer_id,
      sellerId: updatedOrder.seller_id,
      productName: updatedOrder.product_name,
      buyerName: updatedOrder.buyer_name
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error applying late fee:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}


export async function handleDamageClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { action, amount } = req.body;
    if (!orderId || !action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Order ID and valid action (approve/reject) are required' });
      return;
    }
    if (action === 'approve' && (!amount || amount <= 0)) {
      res.status(400).json({ error: 'Valid amount is required for approval' });
      return;
    }

    const updatedOrder = await AdminService.handleDamageClaim(orderId, { action, amount });
    
    // Trigger damage claim notifications
    if (action === 'approve') {
      await NotificationTriggers.triggerDamageReported(
        updatedOrder.seller_id,
        updatedOrder.buyer_id,
        updatedOrder.product_name,
        orderId
      );
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error handling damage claim:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getSellerEarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sellerId } = req.params;
    if (!sellerId) {
      res.status(400).json({ error: 'Seller ID is required' });
      return;
    }
    const earnings = await AdminService.getSellerEarnings(sellerId);
    res.status(200).json(earnings);
  } catch (error) {
    console.error('Error fetching seller earnings:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updatePlatformCommission(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const { commission } = req.body;
    if (!productId || commission === undefined || commission < 0 || commission > 100) {
      res.status(400).json({ error: 'Product ID and valid commission percentage (0-100) are required' });
      return;
    }
    const updatedProduct = await AdminService.updatePlatformCommission(productId, commission);
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating platform commission:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getSecurityDeposits(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const deposits = await AdminService.getSecurityDeposits(status as "pending" | "processing" | "paid" | undefined);
    res.status(200).json(deposits);
  } catch (error) {
    console.error('Error fetching security deposits:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function processSecurityDeposit(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { action, refundAmount } = req.body;
    if (!orderId || !action || !['release', 'partially_refunded', 'forfeited'].includes(action)) {
      res.status(400).json({ error: 'Order ID and valid action (release/partially_refunded/forfeited) are required' });
      return;
    }
    if (action === 'partially_refunded' && (!refundAmount || refundAmount <= 0)) {
      res.status(400).json({ error: 'Valid refund amount is required for partial refunds' });
      return;
    }

    const updatedOrder = await AdminService.processSecurityDeposit(orderId, action, refundAmount);
    
    // Trigger security deposit processing notifications
    await NotificationHelpers.handleSecurityDepositProcessing(orderId, action, {
      buyerId: updatedOrder.buyer_id,
      sellerId: updatedOrder.seller_id,
      productName: updatedOrder.product_name
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error processing security deposit:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getWithdrawalRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    const withdrawals = await AdminService.getWithdrawalRequests(status as "pending" | "processing" | "paid" | undefined);
    res.status(200).json(withdrawals);
  } catch (error) {
    console.error('Error fetching withdrawal requests:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function processWithdrawalRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;
    if (!paymentId || !status || !['processing', 'paid'].includes(status)) {
      res.status(400).json({ error: 'Payment ID and valid status (processing/paid) are required' });
      return;
    }

    const updatedPayment = await AdminService.processWithdrawalRequest(paymentId, status);
    
    // Trigger payout notification when payment is marked as paid
    if (status === 'paid') {
      await NotificationTriggers.triggerPayoutSent(
        updatedPayment.seller_id,
        updatedPayment.amount.toString(),
        updatedPayment.product_name || 'Multiple Products'
      );
    }

    res.status(200).json(updatedPayment);
  } catch (error) {
    console.error('Error processing withdrawal request:', (error as Error).message);
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
    if (action === 'create' && (!referralData?.referrerId || !referralData?.rewardAmount)) {
      res.status(400).json({ error: 'Referrer ID and reward amount are required for create' });
      return;
    }
    if (action === 'update' && (!referralId || !referralData?.rewardAmount)) {
      res.status(400).json({ error: 'Referral ID and reward amount are required for update' });
      return;
    }
    const result = await AdminService.manageReferralProgram(action, referralId, referralData);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error managing referral program:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function managePromoCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { action, promoData } = req.body;
    console.log(action, promoData);
    if (!action || !['create', 'update'].includes(action)) {
      res.status(400).json({ error: 'Valid action (create/update) is required' });
      return;
    }
    if (!promoData || !promoData.code || !promoData.discount_type || !promoData.discount_value || !promoData.expiry_date) {
      res.status(400).json({ error: 'Required promo data (code, discount_type, discount_value, expiry_date) is missing' });
      return;
    }
    let result;
    if (action === 'create') {
      result = await AdminService.createPromoCode({
        code: promoData.code,
        description: promoData.description,
        discount_type: promoData.discount_type,
        discount_value: promoData.discount_value,
        max_discount_amount: promoData.max_discount_amount,
        min_order_amount: promoData.min_order_amount,
        expiry_date: new Date(promoData.expiry_date),
        eligibility: promoData.eligibility || 'all',
        specific_user_ids: promoData.specific_user_ids,
        max_usage_count: promoData.max_usage_count,
      });

      console.log('Promo code created:', result);
    } else {
      if (!promoData.id) {
        res.status(400).json({ error: 'Promo ID is required for update' });
        return;
      }
      result = await AdminService.updatePromoCode(promoData.id, {
        code: promoData.code,
        description: promoData.description,
        discount_type: promoData.discount_type,
        discount_value: promoData.discount_value,
        max_discount_amount: promoData.max_discount_amount,
        min_order_amount: promoData.min_order_amount,
        expiry_date: new Date(promoData.expiry_date),
        eligibility: promoData.eligibility,
        specific_user_ids: promoData.specific_user_ids,
        max_usage_count: promoData.max_usage_count,
        is_active: promoData.is_active,
      });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error('Error managing promo code:', (error as Error).message);
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
    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error assigning delivery:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getMissedPickups(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const missedPickups = await AdminService.getMissedPickups();
    res.status(200).json(missedPickups);
  } catch (error) {
    console.error('Error fetching missed pickups:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function applyPromoCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const { promoCode } = req.body;
    if (!orderId || !promoCode) {
      res.status(400).json({ error: 'Order ID and promo code are required' });
      return;
    }
    if (!req.user?.id) {
      res.status(401).json({ error: 'User authentication required' });
      return;
    }
    const updatedOrder = await AdminService.applyPromoCode(orderId, promoCode, req.user.id);
    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error applying promo code:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getAllPromoCodes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const promoCodes = await AdminService.getAllPromoCodes();
    console.log("Promo Codes: ", promoCodes);
    res.status(200).json(promoCodes);
  } catch (error) {
    console.error('Error fetching promo codes:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function createOrUpdateCommission(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { commissionPercentage, productId } = req.body;
    console.log("Request body: ", req.body);

    // Validate inputs
    if (commissionPercentage === undefined || commissionPercentage < 0 || commissionPercentage > 100) {
      res.status(400).json({ error: "Valid commission percentage (0-100) is required" });
      return;
    }

    let updatedCommission;
    
    if (req.params.commissionId) {
      // Update existing commission - don't change is_global, only update percentage and productId
      updatedCommission = await AdminService.updateCommission(
        req.params.commissionId,
        commissionPercentage,
        productId // Don't modify is_global during update
      );
    } else {
      // Create new commission - determine is_global based on productId
      const isGlobal = !productId; // If no productId, it's global
      
      if (!isGlobal && !productId) {
        res.status(400).json({ error: "Product ID is required for product-specific commissions" });
        return;
      }

      // Check if a global commission already exists (only for new global commissions)
      if (isGlobal) {
        const existingGlobalCommission = await AdminService.getGlobalCommission();
        if (existingGlobalCommission) {
          res.status(400).json({ error: "A global commission already exists. You can only update or delete it." });
          return;
        }
      }

      updatedCommission = await AdminService.createCommission(
        commissionPercentage,
        isGlobal ? null : productId,
        isGlobal
      );
    }

    res.status(200).json(updatedCommission);
  } catch (error) {
    console.error("Error processing commission:", (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}
// Delete a commission
export async function deleteCommission(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { commissionId } = req.params;
    if (!commissionId) {
      res.status(400).json({ error: "Commission ID is required" });
      return;
    }

    await AdminService.deleteCommission(commissionId);
    res.status(200).json({ message: "Commission deleted successfully" });
  } catch (error) {
    console.error("Error deleting commission:", (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

// Fetch all commissions
export async function getCommissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const commissions = await AdminService.getCommissions();
    res.status(200).json(commissions);
  } catch (error) {
    console.error("Error fetching commissions:", (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getAllReferrals(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const referrals = await AdminService.getAllReferrals();
    res.status(200).json(referrals);
  } catch (error) {
    console.error('Error fetching referrals:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getReferralRewards(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rewards = await AdminService.getAllReferralRewards();
    res.status(200).json(rewards);
  } catch (error) {
    console.error('Error fetching referral rewards:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function createReferralReward(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rewardData = req.body;
    console.log("Reward data:", rewardData);
    const newReward = await AdminService.createReferralReward(rewardData);
    res.status(201).json(newReward);
  } catch (error) {
    console.error('Error creating referral reward:', (error as Error).message);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function updateReferralReward(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { rewardId } = req.params;
    const rewardData = req.body;
    const updatedReward = await AdminService.updateReferralReward(rewardId, rewardData);
    res.status(200).json(updatedReward);
  } catch (error) {
    console.error('Error updating referral reward:', (error as Error).message);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function deleteReferralReward(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { rewardId } = req.params;
    await AdminService.deleteReferralReward(rewardId);
    res.status(200).json({ message: 'Referral reward deleted successfully' });
  } catch (error) {
    console.error('Error deleting referral reward:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}