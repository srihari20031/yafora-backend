import { Router } from 'express';
import {
  generateKYCUploadUrl,
  confirmKYCDocumentUpload,
  getUserKYCDocuments,
  generateDocumentViewUrl,
  submitKYCVerification,
  getKYCStatus,
  deleteKYCDocument,
  getPendingKYCVerifications,
  reviewKYCVerification,
  uploadKYCDocument,
  kycUploadMiddleware,
  blockBuyer,    // NEW
  unblockBuyer,  // NEW
} from '../controller/kycController';

const router = Router();

// ─── User Routes ─────────────────────────────────────────────────────────────

router.post('/:userId/documents/upload-url', generateKYCUploadUrl);
router.post('/:userId/documents/confirm-upload', confirmKYCDocumentUpload);
router.post('/:userId/documents/upload', kycUploadMiddleware.array('documents', 5), uploadKYCDocument);
router.get('/:userId/documents', getUserKYCDocuments);
router.post('/:userId/documents/:documentId/view-url', generateDocumentViewUrl);
router.post('/:userId/submit', submitKYCVerification);
router.get('/:userId/status', getKYCStatus);
router.delete('/:userId/documents/:documentId', deleteKYCDocument);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

router.get('/admin/pending', getPendingKYCVerifications);
router.post('/admin/verification/:verificationId/review', reviewKYCVerification);
router.post('/admin/users/:userId/block', blockBuyer);      // NEW
router.post('/admin/users/:userId/unblock', unblockBuyer);  // NEW

export default router;