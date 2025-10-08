import { Router } from "express";
import {
  getSellerOrdersList,
  updateSellerOrderDelivery,
  refundSecurityDepositController,
  reportSellerOrderDamage,
  cancelSellerOrder,
  getSellerTotalTransactionsController,
  getSellerReviewsList
} from "../controller/sellerOrderController";

const router = Router();

router.get('/:sellerId', getSellerOrdersList);
router.put('/:orderId/delivery-status', updateSellerOrderDelivery);
router.post('/:orderId/refund-security-deposit', refundSecurityDepositController);
router.post('/:orderId/damage', reportSellerOrderDamage);
router.delete('/:orderId', cancelSellerOrder);
router.get('/:sellerId/total-transactions', getSellerTotalTransactionsController);
router.get('/sellers/:sellerId/reviews', getSellerReviewsList);

export default router;