import { Request, Response } from 'express';
import {
  createReview,
  updateReview,
  deleteReview,
  getProductReviews,
  getSellerReviews,
  getBuyerReviews,
  getSellerReviewStats,
  canBuyerReviewProduct
} from '../services/reviewService';

// Create a new review
export async function createProductReview(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  const { buyerId, orderId, rating, comment } = req.body;

  // Validate required fields
  if (!buyerId || !orderId || !rating) {
    res.status(400).json({ 
      error: 'Missing required fields: buyerId, orderId, and rating are required' 
    });
    return;
  }

  // Validate rating range
  if (rating < 1 || rating > 5) {
    res.status(400).json({ 
      error: 'Rating must be between 1 and 5' 
    });
    return;
  }

  try {
    const review = await createReview(productId, buyerId, orderId, rating, comment);
    res.status(201).json({
      message: 'Review created successfully',
      review
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// Update an existing review
export async function updateProductReview(req: Request, res: Response): Promise<void> {
  const { reviewId } = req.params;
  const { buyerId, rating, comment } = req.body;

  if (!buyerId) {
    res.status(400).json({ 
      error: 'buyerId is required for authorization' 
    });
    return;
  }

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    res.status(400).json({ 
      error: 'Rating must be between 1 and 5' 
    });
    return;
  }

  try {
    const review = await updateReview(reviewId, buyerId, rating, comment);
    res.status(200).json({
      message: 'Review updated successfully',
      review
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// Delete a review
export async function deleteProductReview(req: Request, res: Response): Promise<void> {
  const { reviewId } = req.params;
  const { buyerId } = req.body;

  if (!buyerId) {
    res.status(400).json({ 
      error: 'buyerId is required for authorization' 
    });
    return;
  }

  try {
    const result = await deleteReview(reviewId, buyerId);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// Get all reviews for a specific product
export async function getProductReviewsList(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const result = await getProductReviews(productId, Number(page), Number(limit));
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// Get all reviews for products by a specific seller
export async function getSellerReviewsList(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const result = await getSellerReviews(sellerId, Number(page), Number(limit));
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// Get all reviews by a specific buyer
export async function getBuyerReviewsList(req: Request, res: Response): Promise<void> {
  const { buyerId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const result = await getBuyerReviews(buyerId, Number(page), Number(limit));
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// Get seller review statistics
export async function getSellerStats(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;

  try {
    const stats = await getSellerReviewStats(sellerId);
    res.status(200).json(stats);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

// Check if buyer can review a product
export async function checkReviewEligibility(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  const { buyerId, orderId } = req.query;

  if (!buyerId || !orderId) {
    res.status(400).json({ 
      error: 'buyerId and orderId are required as query parameters' 
    });
    return;
  }

  try {
    const result = await canBuyerReviewProduct(
      buyerId as string, 
      productId, 
      orderId as string
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}