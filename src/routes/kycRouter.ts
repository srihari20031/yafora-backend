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
} from '../controller/kycController';


const router = Router();

// User routes
router.post('/:userId/documents/upload-url', generateKYCUploadUrl);
router.post('/:userId/documents/confirm-upload', confirmKYCDocumentUpload);
// Assuming you want to upload a single file with the field name 'document'
router.post('/:userId/documents/upload', kycUploadMiddleware.array('documents', 5), uploadKYCDocument);
router.get('/:userId/documents', getUserKYCDocuments);
router.post('/:userId/documents/:documentId/view-url', generateDocumentViewUrl);
router.post('/:userId/submit', submitKYCVerification);
router.get('/:userId/status', getKYCStatus);
router.delete('/:userId/documents/:documentId', deleteKYCDocument);

// Admin routes
router.get('/admin/pending', getPendingKYCVerifications);
router.post('/admin/verification/:verificationId/review', reviewKYCVerification);

export default router;