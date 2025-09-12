import express from 'express';
import * as AdminController from '../controller/adminController';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddlware';

const router = express.Router();

// User management routes
router.get('/users', authMiddleware, adminMiddleware, AdminController.getAllUsers);
router.get('/users/:userId', authMiddleware, adminMiddleware, AdminController.getUserById);
router.patch('/users/:userId/status', authMiddleware, adminMiddleware, AdminController.updateUserStatus);

// Product management routes
router.get('/products', authMiddleware, adminMiddleware, AdminController.getAllProducts);
router.patch('/products/:productId/status', authMiddleware, adminMiddleware, AdminController.updateProductStatus);
router.patch('/products/:productId/commission', authMiddleware, adminMiddleware, AdminController.updatePlatformCommission);

// Order management routes
router.get('/orders', authMiddleware, adminMiddleware, AdminController.getAllOrders);
router.patch('/orders/:orderId/status', authMiddleware, adminMiddleware, AdminController.updateOrderStatus);
router.patch('/orders/:orderId/late-fee', authMiddleware, adminMiddleware, AdminController.applyLateFee);
router.patch('/orders/:orderId/damage-claim', authMiddleware, adminMiddleware, AdminController.handleDamageClaim);

// Financial management routes
router.get('/earnings/:sellerId', authMiddleware, adminMiddleware, AdminController.getSellerEarnings);
router.get('/security-deposits', authMiddleware, adminMiddleware, AdminController.getSecurityDeposits);
router.patch('/security-deposits/:orderId', authMiddleware, adminMiddleware, AdminController.processSecurityDeposit);
router.get('/withdrawals', authMiddleware, adminMiddleware, AdminController.getWithdrawalRequests);
router.patch('/withdrawals/:paymentId', authMiddleware, adminMiddleware, AdminController.processWithdrawalRequest);
router.post('/commissions', authMiddleware, adminMiddleware, AdminController.createOrUpdateCommission);
router.get('/commissions', authMiddleware, adminMiddleware, AdminController.getCommissions);
router.patch('/commissions/:commissionId', authMiddleware, adminMiddleware, AdminController.createOrUpdateCommission);
router.delete('/commissions/:commissionId', authMiddleware, adminMiddleware, AdminController.deleteCommission);

// Marketing management routes
router.post('/referrals', authMiddleware, adminMiddleware, AdminController.manageReferralProgram);
router.get('/referrals', authMiddleware, adminMiddleware, AdminController.getAllReferrals)
router.post('/promos', authMiddleware, adminMiddleware, AdminController.managePromoCode);
router.get('/promos', authMiddleware, adminMiddleware, AdminController.getAllPromoCodes);
router.patch('/orders/:orderId/promo', authMiddleware, adminMiddleware, AdminController.applyPromoCode);

// Delivery management routes
router.post('/delivery/assign', authMiddleware, adminMiddleware, AdminController.assignDelivery);
router.get('/delivery/missed', authMiddleware, adminMiddleware, AdminController.getMissedPickups);

//referral rewards management routes
router.get('/referral-rewards', authMiddleware, adminMiddleware, AdminController.getReferralRewards);
router.post('/referral-rewards', authMiddleware, adminMiddleware, AdminController.createReferralReward);
router.patch('/referral-rewards/:rewardId', authMiddleware, adminMiddleware, AdminController.updateReferralReward);
router.delete('/referral-rewards/:rewardId', authMiddleware, adminMiddleware, AdminController.deleteReferralReward);

//delivery-partner
router.get('/delivery-partners', authMiddleware, adminMiddleware, AdminController.getAllDeliveryPartners);
router.get('/delivery-partners/:deliveryPartnerId/stats', authMiddleware, adminMiddleware, AdminController.getDeliveryPartnerStats);

// FIXED: Split the problematic optional parameter route into two separate routes
router.get('/delivery-assignments', authMiddleware, adminMiddleware, AdminController.getDeliveryPartnerAssignments);
router.get('/delivery-assignments/:deliveryPartnerId', authMiddleware, adminMiddleware, AdminController.getDeliveryPartnerAssignments);

router.get('/orders/needs-delivery', authMiddleware, adminMiddleware, AdminController.getOrdersNeedingDelivery);
router.post('/delivery/assign-partner', authMiddleware, adminMiddleware, AdminController.assignDeliveryPartner);
router.patch('/delivery/reassign/:orderId', authMiddleware, adminMiddleware, AdminController.reassignDeliveryPartner);
router.delete('/delivery/remove-assignment/:orderId', authMiddleware, adminMiddleware, AdminController.removeDeliveryAssignment);

export default router;