import { Router } from "express";
import { addProductToWishlist, checkWishlistStatus, getWishlist, removeProductFromWishlist } from "../controller/wishlistController";

const router = Router();

router.post('/wishlist', addProductToWishlist);
router.delete('/wishlist/:buyerId/:productId', removeProductFromWishlist);
router.get('/wishlist/:buyerId', getWishlist);
router.get('/wishlist/:buyerId/:productId/status', checkWishlistStatus);

export default router;