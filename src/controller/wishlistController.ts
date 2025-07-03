import { Request, Response } from 'express';
import { addToWishlist, removeFromWishlist, getUserWishlist, checkIfInWishlist } from '../services/wishlistService';

export async function addProductToWishlist(req: Request, res: Response): Promise<void> {
  const { buyerId, productId } = req.body;
  console.log('Adding product to wishlist:', { buyerId, productId });
  
  try {
    const wishlistItem = await addToWishlist(buyerId, productId);
    res.status(201).json({ 
      message: 'Product added to wishlist', 
      wishlistItem 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function removeProductFromWishlist(req: Request, res: Response): Promise<void> {
  const { buyerId, productId } = req.params;
  
  try {
    await removeFromWishlist(buyerId, productId);
    res.status(200).json({ message: 'Product removed from wishlist' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getWishlist(req: Request, res: Response): Promise<void> {
  const { buyerId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  try {
    const wishlist = await getUserWishlist(
      buyerId, 
      Number(page), 
      Number(limit)
    );
    res.status(200).json({ wishlist });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function checkWishlistStatus(req: Request, res: Response): Promise<void> {
  const { buyerId, productId } = req.params;
  
  try {
    const isInWishlist = await checkIfInWishlist(buyerId, productId);
    res.status(200).json({ isInWishlist });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}