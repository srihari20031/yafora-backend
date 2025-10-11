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
import { authMiddleware } from "../middleware/authMiddlware";

const router = Router();

// Basic CRUD operations
router.post('/', authMiddleware, uploadMiddleware, addProduct);

// Specific routes FIRST (before :productId)
router.get('/search', searchProductsHandler);
router.get('/featured', getFeaturedProductsHandler);
router.get('/category/:category', getProductsByCategories);

// Generic routes LAST (after specific ones)
router.get('/:productId', getProduct);
router.put('/:productId', authMiddleware, uploadMiddleware, editProduct);
router.delete('/:productId', authMiddleware, removeProduct);

// Seller-specific products
router.get('/seller/:sellerId/products', getMyProducts);

export default router;