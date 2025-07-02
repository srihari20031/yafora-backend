import { Request, Response } from 'express';
import multer from 'multer';
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

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('[ProductController] File filter called:', { 
      filename: file.originalname, 
      mimetype: file.mimetype 
    });
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      console.error('[ProductController] File filter rejected non-image file:', file.originalname);
      cb(new Error('Only image files are allowed!'));
    }
  }
});

export const uploadMiddleware = upload.array('images', 10); // Max 10 images

export async function addProduct(req: Request, res: Response): Promise<void> {
  console.log('[ProductController] addProduct called:', { 
    body: req.body, 
    fileCount: req.files ? (req.files as Express.Multer.File[]).length : 0 
  });
  
  try {
    const productData = req.body;
    console.log('[ProductController] Parsed product data:', productData);

    const tempProductId = uuidv4();
    console.log('[ProductController] Generated tempProductId:', tempProductId);
    
    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('[ProductController] Processing file uploads:', { fileCount: req.files.length });
      // Convert multer files to File objects
      const files = req.files.map(file => {
        console.log('[ProductController] Converting file:', file.originalname);
        return new File([file.buffer], file.originalname, { type: file.mimetype });
      });
      
      imageUrls = await uploadMultipleImages(files, tempProductId);
      console.log('[ProductController] Uploaded image URLs:', imageUrls);
    }
    
    // Handle additional image URLs from request body
    if (productData.imageUrls && Array.isArray(JSON.parse(productData.imageUrls))) {
      const urls = JSON.parse(productData.imageUrls);
      console.log('[ProductController] Parsed image URLs from body:', urls);
      imageUrls = [...imageUrls, ...urls];
    }
    
    // Create product with image URLs
    const finalProductData = {
      ...productData,
      images: imageUrls
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

export async function editProduct(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  
  console.log('[ProductController] editProduct called:', { productId, body: req.body, fileCount: req.files ? (req.files as Express.Multer.File[]).length : 0 });
  
  try {
    const productData = req.body;
    console.log('[ProductController] Parsed product data:', productData);
    
    // Get existing product to compare images
    const existingProduct = await getProductById(productId);
    console.log('[ProductController] Retrieved existing product:', existingProduct);
    
    // Handle new image uploads if files are present
    let newImageUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('[ProductController] Processing new file uploads:', { fileCount: req.files.length });
      const files = req.files.map(file => {
        console.log('[ProductController] Converting file:', file.originalname);
        return new File([file.buffer], file.originalname, { type: file.mimetype });
      });
      
      newImageUrls = await uploadMultipleImages(files, productId);
      console.log('[ProductController] New uploaded image URLs:', newImageUrls);
    }
    
    // Combine existing images (that weren't removed) with new uploads
    let finalImages: string[] = [];
    
    // Add existing images that should be kept
    if (productData?.existingImages && Array.isArray(JSON.parse(productData?.existingImages))) {
      finalImages = [...finalImages, ...JSON.parse(productData?.existingImages)];
      console.log('[ProductController] Keeping existing images:', finalImages);
    }
    
    // Add new uploaded images
    finalImages = [...finalImages, ...newImageUrls];
    console.log('[ProductController] Added new uploaded images:', finalImages);
    
    // Add any additional URLs from request body
    if (productData?.imageUrls && Array.isArray(JSON.parse(productData?.imageUrls))) {
      const urls = JSON.parse(productData?.imageUrls);
      console.log('[ProductController] Parsed additional image URLs:', urls);
      finalImages = [...finalImages, ...urls];
    }
    
    // Delete removed images from storage
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
    
    // Extract only the fields that should be updated in the database
    // Exclude 'existingImages' and 'imageUrls' as they are only for processing
    const { existingImages, imageUrls, ...dbProductData } = productData;
    
    const finalProductData = {
      ...dbProductData,
      images: finalImages
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

export async function removeProduct(req: Request, res: Response): Promise<void> {
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
    minPrice, 
    maxPrice, 
    size, 
    availability,
    featured,
    page = 1, 
    limit = 10 
  } = req.query;
  console.log('[ProductController] searchProductsHandler called:', {
    searchQuery: q,
    filters: { category, minPrice, maxPrice, size, availability, featured },
    page,
    limit
  });
  
  try {
    const filters = {
      category: category as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      size: size as string,
      availability: availability as string,
      featured: featured === 'true' || featured === '1'
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