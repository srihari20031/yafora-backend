import { Router } from "express";
import { getProfile, getUserKYCStatus, submitKYCDocuments, updateUserBankDetails, updateUserProfile } from "../controller/profileController";

const router = Router();

router.get('/:userId', getProfile);
router.put('/:userId', updateUserProfile);
router.post('/:userId/kyc', submitKYCDocuments);
router.put('/:userId/bank', updateUserBankDetails);
router.get('/:userId/kyc-status', getUserKYCStatus);

export default router;