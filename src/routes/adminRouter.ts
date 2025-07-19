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
router.post('/promos', authMiddleware, adminMiddleware, AdminController.managePromoCode);
router.get('/promos', authMiddleware, adminMiddleware, AdminController.getAllPromoCodes);
router.patch('/orders/:orderId/promo', authMiddleware, adminMiddleware, AdminController.applyPromoCode);

// Delivery management routes
router.post('/delivery/assign', authMiddleware, adminMiddleware, AdminController.assignDelivery);
router.get('/delivery/missed', authMiddleware, adminMiddleware, AdminController.getMissedPickups);

export default router;