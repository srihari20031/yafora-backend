import { Router } from "express";
import {
  createProductReview,
  updateProductReview,
  deleteProductReview,
  getProductReviewsList,
  getSellerReviewsList,
  getBuyerReviewsList,
  getSellerStats,
  checkReviewEligibility
} from "../controller/reviewController";

const router = Router();

// Product review routes
router.post('/products/:productId', createProductReview);
router.get('/products/:productId', getProductReviewsList);
router.get('/products/:productId/can-review', checkReviewEligibility);

// Review management routes
router.put('/:reviewId', updateProductReview);
router.delete('/:reviewId', deleteProductReview);

// Seller review routes
router.get('/sellers/:sellerId', getSellerReviewsList);
router.get('/sellers/:sellerId/stats', getSellerStats);

// Buyer review routes
router.get('/buyers/:buyerId', getBuyerReviewsList);

export default router;