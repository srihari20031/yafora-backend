import { Request, Response } from 'express';
import { createProduct,   
    deleteProduct, 
  getProductById,
  getSellerProducts,
  searchProducts,
  getProductsByCategory, 
  updateProduct} from '../services/productService';




export async function addProduct(req: Request, res: Response): Promise<void> {
  const productData = req.body;
  
  try {
    const product = await createProduct(productData);
    res.status(201).json({ 
      message: 'Product created successfully', 
      product 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function editProduct(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  const productData = req.body;
  
  try {
    const product = await updateProduct(productId, productData);
    res.status(200).json({ 
      message: 'Product updated successfully', 
      product 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function removeProduct(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  
  try {
    await deleteProduct(productId);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  
  try {
    const product = await getProductById(productId);
    res.status(200).json({ product });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}

export async function getMyProducts(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  try {
    const products = await getSellerProducts(
      sellerId, 
      Number(page), 
      Number(limit)
    );
    res.status(200).json({ products });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function searchProductsHandler(req: Request, res: Response): Promise<void> {
  const { 
    q, 
    category, 
    minPrice, 
    maxPrice, 
    size, 
    availability,
    page = 1, 
    limit = 10 
  } = req.query;
  
  try {
    const filters = {
      category: category as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      size: size as string,
      availability: availability as string
    };
    
    const products = await searchProducts(
      q as string, 
      filters, 
      Number(page), 
      Number(limit)
    );
    
    res.status(200).json({ products });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getProductsByCategories(req: Request, res: Response): Promise<void> {
  const { category } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  try {
    const products = await getProductsByCategory(
      category, 
      Number(page), 
      Number(limit)
    );
    res.status(200).json({ products });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}