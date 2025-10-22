// routes/userRoutes.ts (updated)

import { Router } from 'express';
import {
  signIn,
  signUp,
  signOut,
  completeReferralController,
  forgotPassword,
  resetPasswordController,
  checkEmailExistsController,
} from '../controller/userController';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
// Complete referral when user performs qualifying action
router.post('/complete-referral', completeReferralController);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordController);
router.post('/check-email', checkEmailExistsController);

export default router;