import { Router } from "express";
import { addProduct, editProduct, getMyProducts, getProduct, getProductsByCategories, removeProduct, searchProductsHandler } from "../controller/productController";

const router = Router();

router.post('/products', addProduct);
router.put('/products/:productId', editProduct);
router.delete('/products/:productId', removeProduct);
router.get('/products/:productId', getProduct);
router.get('/seller/:sellerId/products', getMyProducts);
router.get('/products/search', searchProductsHandler);
router.get('/products/category/:category', getProductsByCategories);

export default router;