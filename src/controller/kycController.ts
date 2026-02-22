import { Request, Response } from 'express';
import { KYCService } from '../services/kycService';
import { createMulterInstance } from '../../utils/multerUtils';
import { sendNotification } from '../services/notificationService';

export const kycUploadMiddleware = createMulterInstance({
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFiles: 5,
  fieldName: 'documents',
});

const kycService = new KYCService();

// Upload KYC document
export async function uploadKYCDocument(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { document_type, id_number, submitted_as_role } = req.body; // NEW: id_number, submitted_as_role

  console.log('[KYCController] uploadKYCDocument called:', {
    userId,
    document_type,
    submitted_as_role,
    fileCount: req.files ? (req.files as Express.Multer.File[]).length : 0,
  });

  try {
    // NEW: Validate id_number
    if (!id_number || id_number.trim() === '') {
      res.status(400).json({ error: 'ID number is required' });
      return;
    }

    // NEW: Validate submitted_as_role
    if (!submitted_as_role || !['buyer', 'seller'].includes(submitted_as_role)) {
      res.status(400).json({ error: 'submitted_as_role must be buyer or seller' });
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const file = req.files[0];
    console.log('[KYCController] Processing file:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    });

    // Pass id_number and submitted_as_role to service (NEW)
    const uploadUrlResponse = await kycService.generateUploadUrl(
      userId,
      document_type,
      file.originalname,
      file.size,
      file.mimetype,
      id_number,           // NEW
      submitted_as_role    // NEW
    );

    const { uploadUrl, fileKey } = uploadUrlResponse;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(file.buffer),
      headers: { 'Content-Type': file.mimetype },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[KYCController] Upload failed:', { status: uploadResponse.status, errorText });
      throw new Error(`Failed to upload file to storage: ${errorText}`);
    }

    const document = await kycService.confirmDocumentUpload(userId, fileKey);

    res.status(200).json({
      message: 'Document uploaded successfully',
      document,
    });
  } catch (error) {
    console.error('[KYCController] Error in uploadKYCDocument:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      userId,
      document_type,
    });
    res.status(400).json({ error: (error as Error).message });
  }
}

// Generate upload URL
export async function generateKYCUploadUrl(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { documentType, fileName, fileSize, mimeType, idNumber, submittedAsRole } = req.body; // NEW params

  try {
    const result = await kycService.generateUploadUrl(
      userId,
      documentType,
      fileName,
      fileSize,
      mimeType,
      idNumber,        // NEW
      submittedAsRole  // NEW
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Confirm document upload
export async function confirmKYCDocumentUpload(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { fileKey } = req.body;

  try {
    const document = await kycService.confirmDocumentUpload(userId, fileKey);
    res.status(200).json({ message: 'Document uploaded successfully', document });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Get user's KYC documents
export async function getUserKYCDocuments(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  try {
    const documents = await kycService.getUserKYCDocuments(userId);
    res.status(200).json({ documents });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Generate document view URL
export async function generateDocumentViewUrl(req: Request, res: Response): Promise<void> {
  const { userId, documentId } = req.params;
  const { role } = req.body;

  try {
    const result = await kycService.generateDocumentViewUrl(userId, documentId, role);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Submit KYC for verification
export async function submitKYCVerification(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { documentIds } = req.body;

  try {
    const verification = await kycService.submitKYCVerification(userId, documentIds);

    try {
      const userDetails = await kycService.getUserProfile(userId);
      await sendNotification({
        userId,
        eventType: 'new_user_registered',
        placeholders: { full_name: userDetails?.full_name || 'Unknown User' },
      });
    } catch (notificationError) {
      console.error('[KYCController] Failed to send admin notification:', notificationError);
    }

    res.status(200).json({ message: 'KYC submitted for verification', verification });
  } catch (error) {
    console.error('[KYCController] Error in submitKYCVerification:', { error: (error as Error).message });
    res.status(400).json({ error: (error as Error).message });
  }
}

// Get KYC status
export async function getKYCStatus(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  try {
    const status = await kycService.getKYCStatus(userId);
    res.status(200).json(status);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Delete KYC document
export async function deleteKYCDocument(req: Request, res: Response): Promise<void> {
  const { userId, documentId } = req.params;

  try {
    await kycService.deleteDocument(userId, documentId);
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Admin: Get pending KYC verifications
export async function getPendingKYCVerifications(req: Request, res: Response): Promise<void> {
  const { limit = 50, offset = 0 } = req.query;

  try {
    const verifications = await kycService.getPendingKYCVerifications(
      parseInt(limit as string),
      parseInt(offset as string)
    );
    res.status(200).json({ pendingVerifications: verifications });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Admin: Review KYC verification
export async function reviewKYCVerification(req: Request, res: Response): Promise<void> {
  const { verificationId } = req.params;
  const { adminId, decision, notes, documentReviews } = req.body;

  try {
    const verification = await kycService.reviewKYCVerification(
      verificationId,
      adminId,
      decision,
      notes,
      documentReviews
    );

    try {
      const userId = verification.userId;

      if (decision === 'approved') {
        await sendNotification({ userId, eventType: 'kyc_approved', placeholders: {} });
      } else if (decision === 'rejected') {
        await sendNotification({
          userId,
          eventType: 'kyc_rejected',
          placeholders: { rejection_reason: notes || 'Please check your documents and resubmit' },
        });
      }
    } catch (notificationError) {
      console.error('[KYCController] Failed to send KYC review notifications:', notificationError);
    }

    res.status(200).json({ message: 'KYC verification reviewed', verification });
  } catch (error) {
    console.error('[KYCController] Error in reviewKYCVerification:', error);
    res.status(400).json({ error: (error as Error).message });
  }
}

// NEW: Admin — Block a buyer
export async function blockBuyer(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { adminId, reason } = req.body;

  if (!reason || reason.trim() === '') {
    res.status(400).json({ error: 'Block reason is required' });
    return;
  }

  if (!adminId) {
    res.status(400).json({ error: 'adminId is required' });
    return;
  }

  try {
    await kycService.blockUser(userId, adminId, reason);
    res.status(200).json({ message: 'Buyer blocked successfully' });
  } catch (error) {
    console.error('[KYCController] Error in blockBuyer:', error);
    res.status(400).json({ error: (error as Error).message });
  }
}

// NEW: Admin — Unblock a buyer
export async function unblockBuyer(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  try {
    await kycService.unblockUser(userId);
    res.status(200).json({ message: 'Buyer unblocked successfully' });
  } catch (error) {
    console.error('[KYCController] Error in unblockBuyer:', error);
    res.status(400).json({ error: (error as Error).message });
  }
}