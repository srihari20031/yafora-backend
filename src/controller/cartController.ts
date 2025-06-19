import { Request, Response } from 'express';
import { addToCart,
      removeFromCart,
  getUserCart,
  updateCartItem,
  clearUserCart,
  checkIfInCart
 } from '../services/cartService';


export async function addProductToCart(req: Request, res: Response): Promise<void> {
  const { buyerId, productId, rentalStartDate, rentalEndDate, tryOnRequested = false } = req.body;
  
  try {
    const cartItem = await addToCart(buyerId, productId, rentalStartDate, rentalEndDate, tryOnRequested);
    res.status(201).json({ 
      message: 'Product added to cart', 
      cartItem 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function removeProductFromCart(req: Request, res: Response): Promise<void> {
  const { buyerId, productId } = req.params;
  
  try {
    await removeFromCart(buyerId, productId);
    res.status(200).json({ message: 'Product removed from cart' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getCart(req: Request, res: Response): Promise<void> {
  const { buyerId } = req.params;
  
  try {
    const cart = await getUserCart(buyerId);
    res.status(200).json({ cart });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function updateCartItemDetails(req: Request, res: Response): Promise<void> {
  const { buyerId, productId } = req.params;
  const { rentalStartDate, rentalEndDate, tryOnRequested } = req.body;
  
  try {
    const updatedItem = await updateCartItem(buyerId, productId, {
      rentalStartDate,
      rentalEndDate,
      tryOnRequested
    });
    res.status(200).json({ 
      message: 'Cart item updated', 
      cartItem: updatedItem 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  const { buyerId } = req.params;
  
  try {
    await clearUserCart(buyerId);
    res.status(200).json({ message: 'Cart cleared successfully' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function checkCartStatus(req: Request, res: Response): Promise<void> {
  const { buyerId, productId } = req.params;
  
  try {
    const isInCart = await checkIfInCart(buyerId, productId);
    res.status(200).json({ isInCart });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}