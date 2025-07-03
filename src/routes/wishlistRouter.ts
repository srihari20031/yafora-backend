import { Router } from "express";
import { addProductToWishlist, checkWishlistStatus, getWishlist, removeProductFromWishlist } from "../controller/wishlistController";

const router = Router();

router.post('/', addProductToWishlist);
router.delete('/:buyerId/:productId', removeProductFromWishlist);
router.get('/:buyerId', getWishlist);
router.get('/:buyerId/:productId/status', checkWishlistStatus);

export default router;