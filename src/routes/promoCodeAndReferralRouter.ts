import { Router } from "express";
import { 
  validatePromoCodeController,
  getReferralLinkController,
  validateReferralController,
  processReferralController,
  getReferralStatsController
} from "../controller/promoCodeAndReferralController";

const router = Router();

// Existing promo code route
router.post('/promo/validate', validatePromoCodeController);

// NEW REFERRAL LINK ROUTES
// Get referral link for sharing
router.get('/referrals/link/:userId', getReferralLinkController);
router.post('/referrals/link/:userId', getReferralLinkController); // If you want to pass custom baseUrl

// Validate referral code from link
router.get('/referrals/validate/:referralCode', validateReferralController);

// Process referral when someone signs up using the link
router.post('/referrals/process', processReferralController);

// Get user's referral statistics (replaces the old /:userId route)
router.get('/referrals/stats/:userId', getReferralStatsController);

export default router;