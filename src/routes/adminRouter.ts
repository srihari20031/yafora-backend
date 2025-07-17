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
router.patch('/withdrawals/:paymentId', authMiddleware, adminMiddleware, AdminController.processWithdrawalRequest);

// Marketing management routes
router.post('/referrals', authMiddleware, adminMiddleware, AdminController.manageReferralProgram);
router.post('/promos', authMiddleware, adminMiddleware, AdminController.managePromoCode);

// Delivery management routes
router.post('/delivery/assign', authMiddleware, adminMiddleware, AdminController.assignDelivery);
router.get('/delivery/missed', authMiddleware, adminMiddleware, AdminController.getMissedPickups);

export default router;