import { Router } from 'express';
import {
  signIn,
  signUp,
  signOut,
  completeReferralController,
} from '../controller/userController';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
// Complete referral when user performs qualifying action
router.post('/complete-referral', completeReferralController);

export default router;