import { Router } from "express";
import {
  addProductToCart,
  removeProductFromCart,
  getCart,
  updateCartItemDetails,
  clearCart,
  checkCartStatus
} from "../controller/cartController";

const router = Router();

// Add product to cart
router.post('/cart', addProductToCart);

// Remove product from cart
router.delete('/cart/:buyerId/:productId', removeProductFromCart);

// Get user's cart
router.get('/cart/:buyerId', getCart);

// Update cart item (rental dates, try-on request)
router.put('/cart/:buyerId/:productId', updateCartItemDetails);

// Clear entire cart
router.delete('/cart/:buyerId', clearCart);

// Check if product is in cart
router.get('/cart/:buyerId/:productId/status', checkCartStatus);

export default router;