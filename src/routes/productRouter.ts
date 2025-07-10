import { Router } from "express";
import { 
  addProduct, 
  editProduct, 
  getMyProducts, 
  getProduct, 
  getProductsByCategories, 
  removeProduct, 
  searchProductsHandler,
  getFeaturedProductsHandler,
  uploadMiddleware
} from "../controller/productController";

const router = Router();

// Basic CRUD operations
router.post('/products', uploadMiddleware, addProduct);

// Specific routes FIRST (before :productId)
router.get('/products/search', searchProductsHandler);
router.get('/products/featured', getFeaturedProductsHandler);
router.get('/products/category/:category', getProductsByCategories);

// Generic routes LAST (after specific ones)
router.get('/products/:productId', getProduct);
router.put('/products/:productId', uploadMiddleware, editProduct);
router.delete('/products/:productId', removeProduct);

// Seller-specific products
router.get('/seller/:sellerId/products', getMyProducts);

export default router;