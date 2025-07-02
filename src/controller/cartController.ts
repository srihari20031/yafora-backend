import { Request, Response } from 'express';
import { 
  addToCart,
  removeFromCart,
  getUserCart,
  updateCartItem,
  clearUserCart,
  checkIfInCart,
  checkProductAvailability
} from '../services/cartService';

export async function addProductToCart(req: Request, res: Response): Promise<void> {
  const { buyerId, productId, rentalStartDate, rentalEndDate, tryOnRequested = false } = req.body;

  console.log('[CartController] Adding product to cart:', {
    buyerId,
    productId,
    rentalStartDate: rentalStartDate || 'Not specified',
    rentalEndDate: rentalEndDate || 'Not specified',
    tryOnRequested
  }); 
  
  try {
    // Check if required fields are present
    if (!buyerId || !productId) {
      res.status(400).json({ error: 'buyerId and productId are required' });
      return;
    }

    // If dates are provided, validate them
    if (rentalStartDate && rentalEndDate) {
      const startDate = new Date(rentalStartDate);
      const endDate = new Date(rentalEndDate);
      
      if (startDate >= endDate) {
        res.status(400).json({ error: 'End date must be after start date' });
        return;
      }
      
      if (startDate < new Date()) {
        res.status(400).json({ error: 'Start date cannot be in the past' });
        return;
      }

      // Check availability for the selected dates
      const isAvailable = await checkProductAvailability(productId, rentalStartDate, rentalEndDate);
      if (!isAvailable) {
        res.status(400).json({ error: 'Product not available for selected dates' });
        return;
      }
    }

    const cartItem = await addToCart(
      buyerId, 
      productId, 
      rentalStartDate || null, // Pass null if not provided
      rentalEndDate || null,   // Pass null if not provided
      tryOnRequested
    );
    
    res.status(201).json({ 
      message: rentalStartDate && rentalEndDate 
        ? 'Product added to cart with dates' 
        : 'Product added to cart (dates can be selected later)', 
      cartItem 
    });
  } catch (err) {
    console.error('[CartController] Error adding to cart:', err);
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
    // If updating dates, check availability
    if (rentalStartDate && rentalEndDate) {
      const isAvailable = await checkProductAvailability(productId, rentalStartDate, rentalEndDate);
      if (!isAvailable) {
        res.status(400).json({ error: 'Product not available for selected dates' });
        return;
      }
    }

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

// New endpoint to check availability for specific dates
export async function checkAvailability(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  const { rentalStartDate, rentalEndDate } = req.query;
  
  try {
    if (!rentalStartDate || !rentalEndDate) {
      res.status(400).json({ error: 'Both rentalStartDate and rentalEndDate are required' });
      return;
    }

    const isAvailable = await checkProductAvailability(
      productId, 
      rentalStartDate as string, 
      rentalEndDate as string
    );
    
    res.status(200).json({ available: isAvailable });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}