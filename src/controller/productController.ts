import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddlware';
import { v4 as uuidv4 } from 'uuid';
import { 
  createProduct,   
  deleteProduct, 
  getProductById,
  getSellerProducts,
  searchProducts,
  getProductsByCategory, 
  updateProduct,
  getFeaturedProducts,
  uploadMultipleImages,
  deleteProductImage
} from '../services/productService';
import { createMulterInstance } from '../../utils/multerUtils';

// Create multer instance for product images
const productImageUpload = createMulterInstance({
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxFiles: 10,
  fieldName: 'images'
});

// Export the middleware for use in routes
export const uploadMiddleware = productImageUpload.array('images', 10);

export async function addProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  console.log('[ProductController] addProduct called:', { 
    body: req.body, 
    fileCount: req.files ? (req.files as Express.Multer.File[]).length : 0 
  });

  try {
    const productData = req.body;
    console.log('[ProductController] Parsed product data:', productData);

    // Parse array fields
    if (productData.tags) {
      productData.tags = JSON.parse(productData.tags);
    }
    if (productData.occasion_tags) {
      productData.occasion_tags = JSON.parse(productData.occasion_tags);
    }
    if (productData.try_on_location) {
      productData.try_on_location = JSON.parse(productData.try_on_location);
    }

    const tempProductId = uuidv4();
    console.log('[ProductController] Generated tempProductId:', tempProductId);

    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('[ProductController] Processing file uploads:', { fileCount: req.files.length });
      imageUrls = await uploadMultipleImages(req.files, tempProductId);
      console.log('[ProductController] Uploaded image URLs:', imageUrls);
    }

    const finalProductData = {
      ...productData,
      seller_id: req.user!.id,
      images: imageUrls,
      rental_price_per_day: Number(productData.rental_price_per_day),
      security_deposit_percentage: Number(productData.security_deposit_percentage),
      weight: productData.weight ? Number(productData.weight) : undefined,
      min_rental_days: Number(productData.min_rental_days),
      max_rental_days: Number(productData.max_rental_days)
    };
    console.log('[ProductController] Final product data for creation:', finalProductData);

    const product = await createProduct(finalProductData);
    console.log('[ProductController] Product created successfully:', product);

    res.status(201).json({ 
      message: 'Product created successfully', 
      product 
    });
  } catch (err) {
    console.error('[ProductController] Error in addProduct:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function editProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { productId } = req.params;

  console.log('[ProductController] editProduct called:', { productId, body: req.body, fileCount: req.files ? (req.files as Express.Multer.File[]).length : 0 });

  try {
    const productData = req.body;
    console.log('[ProductController] Parsed product data:', productData);

    // Parse array fields
    if (productData.tags) {
      productData.tags = JSON.parse(productData.tags);
    }
    if (productData.occasion_tags) {
      productData.occasion_tags = JSON.parse(productData.occasion_tags);
    }
    if (productData.try_on_location) {
      productData.try_on_location = JSON.parse(productData.try_on_location);
    }
    if (productData.existingImages) {
      productData.existingImages = JSON.parse(productData.existingImages);
    }

    const existingProduct = await getProductById(productId);
    console.log('[ProductController] Retrieved existing product:', existingProduct);

    let newImageUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('[ProductController] Processing new file uploads:', { fileCount: req.files.length });
      newImageUrls = await uploadMultipleImages(req.files, productId);
      console.log('[ProductController] New uploaded image URLs:', newImageUrls);
    }

    let finalImages: string[] = [];
    if (productData.existingImages && Array.isArray(productData.existingImages)) {
      finalImages = [...productData.existingImages];
      console.log('[ProductController] Keeping existing images:', finalImages);
    }

    finalImages = [...finalImages, ...newImageUrls];
    console.log('[ProductController] Combined image URLs:', finalImages);

    if (existingProduct.images) {
      const imagesToDelete = existingProduct.images.filter(
        (img: string) => !finalImages.includes(img)
      );
      console.log('[ProductController] Images to delete:', imagesToDelete);

      for (const imageUrl of imagesToDelete) {
        console.log('[ProductController] Deleting image:', imageUrl);
        await deleteProductImage(imageUrl);
      }
    }

    const { existingImages, imageUrls, ...dbProductData } = productData;

    const finalProductData = {
      ...dbProductData,
      images: finalImages,
      rental_price_per_day: Number(productData.rental_price_per_day),
      security_deposit_percentage: Number(productData.security_deposit_percentage),
      weight: productData.weight ? Number(productData.weight) : undefined,
      min_rental_days: Number(productData.min_rental_days),
      max_rental_days: Number(productData.max_rental_days)
    };
    console.log('[ProductController] Final product data for update:', finalProductData);

    const product = await updateProduct(productId, finalProductData);
    console.log('[ProductController] Product updated successfully:', product);

    res.status(200).json({ 
      message: 'Product updated successfully', 
      product 
    });
  } catch (err) {
    console.error('[ProductController] Error in editProduct:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function removeProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { productId } = req.params;
  console.log('[ProductController] removeProduct called:', { productId });

  try {
    await deleteProduct(productId);
    console.log('[ProductController] Product deleted successfully:', { productId });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('[ProductController] Error in removeProduct:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  console.log('[ProductController] getProduct called:', { productId });

  try {
    const product = await getProductById(productId);
    console.log('[ProductController] Product retrieved successfully:', product);
    res.status(200).json({ product });
  } catch (err) {
    console.error('[ProductController] Error in getProduct:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(404).json({ error: (err as Error).message });
  }
}

export async function getMyProducts(req: Request, res: Response): Promise<void> {
  const { sellerId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  console.log('[ProductController] getMyProducts called:', { sellerId, page, limit });

  try {
    const result = await getSellerProducts(
      sellerId, 
      Number(page), 
      Number(limit)
    );
    console.log('[ProductController] Seller products retrieved:', {
      productCount: result.products.length,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('[ProductController] Error in getMyProducts:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function searchProductsHandler(req: Request, res: Response): Promise<void> {
  const { 
    q, 
    category, 
    subcategory,
    minPrice, 
    maxPrice, 
    size, 
    availability,
    featured,
    color,
    material,
    tags,
    occasion_tags,
    condition,
    page = 1, 
    limit = 10 
  } = req.query;
  console.log('[ProductController] searchProductsHandler called:', {
    searchQuery: q,
    filters: { category, subcategory, minPrice, maxPrice, size, availability, featured, color, material, tags, occasion_tags, condition },
    page,
    limit
  });

  try {
    const filters = {
      category: category as string,
      subcategory: subcategory as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      size: size as string,
      availability: availability as string,
      featured: featured === 'true' || featured === '1',
      color: color as string,
      material: material as string,
      tags: tags ? JSON.parse(tags as string) : undefined,
      occasion_tags: occasion_tags ? JSON.parse(occasion_tags as string) : undefined,
      condition: condition as string
    };
    console.log('[ProductController] Parsed filters:', filters);

    const products = await searchProducts(
      q as string, 
      filters, 
      Number(page), 
      Number(limit)
    );
    console.log('[ProductController] Search results:', {
      productCount: products.products.length,
      total: products.total,
      page: products.page,
      totalPages: products.totalPages
    });

    res.status(200).json(products);
  } catch (err) {
    console.error('[ProductController] Error in searchProductsHandler:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getProductsByCategories(req: Request, res: Response): Promise<void> {
  const { category } = req.params;
  const { page = 1, limit = 10 } = req.query;
  console.log('[ProductController] getProductsByCategories called:', { category, page, limit });

  try {
    const products = await getProductsByCategory(
      category, 
      Number(page), 
      Number(limit)
    );
    console.log('[ProductController] Category products retrieved:', {
      productCount: products.products.length,
      total: products.total,
      page: products.page,
      totalPages: products.totalPages
    });

    res.status(200).json(products);
  } catch (err) {
    console.error('[ProductController] Error in getProductsByCategories:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getFeaturedProductsHandler(req: Request, res: Response): Promise<void> {
  const { page = 1, limit = 10 } = req.query;
  console.log('[ProductController] getFeaturedProductsHandler called:', { page, limit });

  try {
    const products = await getFeaturedProducts(
      Number(page), 
      Number(limit)
    );
    console.log('[ProductController] Featured products retrieved:', {
      productCount: products.products.length,
      total: products.total,
      page: products.page,
      totalPages: products.totalPages
    });

    res.status(200).json(products);
  } catch (err) {
    console.error('[ProductController] Error in getFeaturedProductsHandler:', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    res.status(400).json({ error: (err as Error).message });
  }
}