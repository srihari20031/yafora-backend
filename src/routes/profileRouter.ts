import { Router } from "express";
import { getProfile, getUserKYCStatus, submitKYCDocuments, updateUserBankDetails, updateUserProfile } from "../controller/profileController";

const router = Router();

router.get('/profile/:userId', getProfile);
router.put('/profile/:userId', updateUserProfile);
router.post('/profile/:userId/kyc', submitKYCDocuments);
router.put('/profile/:userId/bank', updateUserBankDetails);
router.get('/profile/:userId/kyc-status', getUserKYCStatus);

export default router;