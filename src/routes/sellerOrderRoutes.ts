import { Router } from "express";
import {
  getSellerOrdersList,
  updateSellerOrderDelivery,
  refundSecurityDepositController,
  reportSellerOrderDamage,
  cancelSellerOrder,
  getSellerTotalTransactionsController,
  getSellerReviewsList,
  acceptOrder,
  rejectOrder,
  getPendingOrders,
  getOrders,
  getSellerStatsController,
  getSellerOrderByIdController
} from "../controller/sellerOrderController";
import { authMiddleware } from "../middleware/authMiddlware";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Order detail route (must be BEFORE /:sellerId to avoid conflict)
router.get('/order/:orderId', getSellerOrderByIdController);

// Legacy routes (keeping for backward compatibility)
router.get('/:sellerId', getSellerOrdersList);
router.put('/:orderId/delivery-status', updateSellerOrderDelivery);
router.post('/:orderId/refund-security-deposit', refundSecurityDepositController);
router.post('/:orderId/damage', reportSellerOrderDamage);
router.delete('/:orderId', cancelSellerOrder);
router.get('/:sellerId/total-transactions', getSellerTotalTransactionsController);
router.get('/:sellerId/stats', getSellerStatsController);
router.get('/sellers/:sellerId/reviews', getSellerReviewsList);

// New seller confirmation routes
router.get('/', getOrders);
router.get('/pending', getPendingOrders);
router.post('/:orderId/accept', acceptOrder);
router.post('/:orderId/reject', rejectOrder);

export default router;