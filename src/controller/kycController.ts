import { Request, Response } from 'express';

import { KYCService } from '../services/kycService';
import { createMulterInstance } from '../../utils/multerUtils';

// Configure Multer for KYC document uploads
export const kycUploadMiddleware = createMulterInstance({
  maxFileSize: 10 * 1024 * 1024, // 10MB for documents
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFiles: 5,
  fieldName: 'documents',
});

const kycService = new KYCService();

export async function uploadKYCDocument(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { document_type } = req.body;



  console.log('[KYCController] uploadKYCDocument called:', {
    userId,
    document_type,
    fileCount: req.files ? (req.files as Express.Multer.File[]).length : 0,
  });

  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new Error('No files uploaded');
    }

    const file = req.files[0];
    console.log('[KYCController] Processing file:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    });

    const uploadUrlResponse = await kycService.generateUploadUrl(
      userId,
      document_type,
      file.originalname,
      file.size,
      file.mimetype
    );

    const { uploadUrl, fileKey } = uploadUrlResponse;

    console.log('[KYCController] Generated upload URL:', { fileKey });

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file.buffer,
      headers: { 'Content-Type': file.mimetype },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[KYCController] Upload failed:', { status: uploadResponse.status, errorText });
      throw new Error(`Failed to upload file to storage: ${errorText}`);
    }

    console.log('[KYCController] File uploaded to storage successfully');

    const document = await kycService.confirmDocumentUpload(userId, fileKey);
    console.log('[KYCController] Document confirmed:', document);

    res.status(200).json({
      message: 'Document uploaded successfully',
      document,
    });
  } catch (error) {
    console.error('[KYCController] Error in uploadKYCDocument:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      userId,
      document_type
    });
    res.status(400).json({ error: (error as Error).message });
  }
}
// Generate upload URL for KYC document
export async function generateKYCUploadUrl(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { documentType, fileName, fileSize, mimeType } = req.body;
  
  try {
    const result = await kycService.generateUploadUrl(
      userId, 
      documentType, 
      fileName, 
      fileSize, 
      mimeType
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
    res.status(200).json({ 
      message: 'Document uploaded successfully', 
      document 
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Get user's KYC documents
export async function getUserKYCDocuments(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  
  try {
    const documents = await kycService.getUserKYCDocuments(userId);
    console.log('[KYCController] Fetched KYC documents for user:', userId, documents.length, 'documents found');
    console.log('[KYCController] Documents:', documents);
    res.status(200).json({ documents });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

// Generate document view URL
export async function generateDocumentViewUrl(req: Request, res: Response): Promise<void> {
  const { userId, documentId } = req.params;
  const { role } = req.body; // 'user' or 'admin'
  
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
    console.log('[KYCController] KYC verification submitted:', verification);
    res.status(200).json({ 
      message: 'KYC submitted for verification', 
      verification 
    });
  } catch (error) {
    console.log('[KYCController] Error in submitKYCVerification:', {
      error: (error as Error).message,})
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
    res.status(200).json({ verifications });
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
    res.status(200).json({ 
      message: 'KYC verification reviewed', 
      verification 
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}