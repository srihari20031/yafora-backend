import { Router } from 'express';
import { signIn, signUp, signOut } from '../controller/userController';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);

export default router;