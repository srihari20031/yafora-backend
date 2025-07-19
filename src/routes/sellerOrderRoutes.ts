import { Router } from "express";
import {
  getSellerOrdersList,
  updateSellerOrderDelivery,
  reportSellerOrderDamage,
  cancelSellerOrder
} from "../controller/sellerOrderController";

const router = Router();

router.get('/:sellerId', getSellerOrdersList);
router.put('/:orderId/delivery-status', updateSellerOrderDelivery);
router.post('/:orderId/damage', reportSellerOrderDamage);
router.delete('/:orderId', cancelSellerOrder);

export default router;