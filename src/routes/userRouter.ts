import { Router } from 'express';
import { signIn, signUp, signOut, testCookies } from '../controller/userController';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/test-cookies', testCookies);

export default router;