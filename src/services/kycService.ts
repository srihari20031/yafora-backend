import supabaseDB from "../../config/connectDB";
import { StorageService } from "./kycStorage";


// types/kyc.ts
export interface KYCDocument {
  id: string;
  userId: string;
  documentType: 'identity_proof' | 'address_proof' | 'bank_statement' | 'pan_card' | 'aadhar_card' | 'passport' | 'driving_license' | 'utility_bill';
  documentName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadStatus: 'pending' | 'uploaded' | 'failed' | 'deleted';
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'expired';
  verifiedBy?: string;
  verificationNotes?: string;
  expiryDate?: Date;
  isCurrent: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
}

export interface KYCVerification {
  id: string;
  userId: string;
  requestType: 'initial' | 'resubmission' | 'update';
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'expired';
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  adminNotes?: string;
  documentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

export interface DocumentViewResponse {
  signedUrl: string;
  expiresIn: number;
  documentInfo: Partial<KYCDocument>;
}

export class KYCService {
  private storageService: StorageService;
  private readonly KYC_BUCKET = 'kyc-documents';

  constructor() {
    this.storageService = new StorageService();
  }

  // Generate signed URL for document upload
  async generateUploadUrl(
    userId: string, 
    documentType: string, 
    fileName: string, 
    fileSize: number,
    mimeType: string
  ): Promise<SignedUrlResponse> {
    // Enforce folder structure: kyc-documents/{userId}/{documentType}/{timestamp}-{fileName}
    const fileKey = `${userId}/${documentType}/${Date.now()}-${fileName}`;
    
    // Generate signed URL for upload
    const uploadUrl = await this.storageService.generatePresignedUploadUrl(
      this.KYC_BUCKET, 
      fileKey, 
      mimeType,
      3600 // 1 hour expiry
    );

    // Create pending document record
    const { data, error } = await supabaseDB
      .from('kyc_documents')
      .insert({
        user_id: userId,
        document_type: documentType,
        document_name: fileName,
        file_path: fileKey,
        file_size: fileSize,
        mime_type: mimeType,
        upload_status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create document record: ${error.message}`);

    return {
      uploadUrl,
      fileKey,
      expiresIn: 3600
    };
  }

  // Confirm document upload
  async confirmDocumentUpload(userId: string, fileKey: string): Promise<KYCDocument> {
    // Verify file exists in storage
    const fileExists = await this.storageService.fileExists(this.KYC_BUCKET, fileKey);
    if (!fileExists) {
      throw new Error('File not found in storage');
    }

    // Update document status
    const { data, error } = await supabaseDB
      .from('kyc_documents')
      .update({ 
        upload_status: 'uploaded',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('file_path', fileKey)
      .select()
      .single();

    if (error) throw new Error(`Failed to update document status: ${error.message}`);

    return data as KYCDocument;
  }

  // Get user's current KYC documents
  async getUserKYCDocuments(userId: string): Promise<KYCDocument[]> {
    const { data, error } = await supabaseDB
      .from('user_current_kyc_documents')
      .select('*')
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to fetch KYC documents: ${error.message}`);

    return data as KYCDocument[];
  }

  // Generate signed URL for document viewing
  async generateDocumentViewUrl(
    userId: string, 
    documentId: string, 
    requestorRole: 'user' | 'admin'
  ): Promise<DocumentViewResponse> {
    // Get document info
    const { data: document, error } = await supabaseDB
      .from('kyc_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) throw new Error(`Document not found: ${error.message}`);

    // Check access permissions
    if (requestorRole === 'user' && document.user_id !== userId) {
      throw new Error('Unauthorized access to document');
    }

    // Generate signed URL for viewing
    const signedUrl = await this.storageService.generatePresignedDownloadUrl(
      this.KYC_BUCKET, 
      document.file_path, 
      3600 // 1 hour expiry
    );

    return {
      signedUrl,
      expiresIn: 3600,
      documentInfo: {
        id: document.id,
        documentType: document.document_type,
        documentName: document.document_name,
        verificationStatus: document.verification_status,
        createdAt: document.created_at
      }
    };
  }

  // Create or update KYC verification request
  async createKYCVerification(
    userId: string, 
    documentIds: string[], 
    requestType: 'initial' | 'resubmission' | 'update' = 'initial'
  ): Promise<KYCVerification> {
    const { data, error } = await supabaseDB
      .from('kyc_verifications')
      .insert({
        user_id: userId,
        request_type: requestType,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        document_ids: documentIds
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create KYC verification: ${error.message}`);

    return data as KYCVerification;
  }

  // Submit KYC for verification
async submitKYCVerification(userId: string, documentIds: string[]): Promise<KYCVerification> {
  // Validate all documents are uploaded
  const { data: documents, error: docError } = await supabaseDB
    .from('kyc_documents')
    .select('id, upload_status')
    .in('id', documentIds)
    .eq('user_id', userId);

  if (docError) throw new Error(`Failed to validate documents: ${docError.message}`);

  const notUploadedDocs = documents?.filter(doc => doc.upload_status !== 'uploaded');
  if (notUploadedDocs && notUploadedDocs.length > 0) {
    throw new Error('All documents must be uploaded before submission');
  }

  // Create verification request
  const verification = await this.createKYCVerification(userId, documentIds, 'initial');

  // Update profiles table with new kyc_status
  const { error: profileError } = await supabaseDB
    .from('profiles')
    .update({
      kyc_status: 'pending', // Use 'pending' to match CHECK constraint
      current_kyc_verification_id: verification.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) throw new Error(`Failed to update profile status: ${profileError.message}`);

  return verification;
}
  // Admin: Get pending KYC verifications
  async getPendingKYCVerifications(limit: number = 50, offset: number = 0): Promise<any[]> {
    const { data, error } = await supabaseDB
      .from('kyc_verification_summary')
      .select('*')
      .eq('verification_status', 'submitted')
      .order('submitted_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch pending verifications: ${error.message}`);

    return data;
  }

  // Admin: Approve/Reject KYC verification
  async reviewKYCVerification(
    verificationId: string, 
    adminId: string, 
    decision: 'approved' | 'rejected', 
    notes?: string,
    documentReviews?: { documentId: string; status: 'approved' | 'rejected'; notes?: string }[]
  ): Promise<KYCVerification> {
    const { data, error } = await supabaseDB
      .from('kyc_verifications')
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        admin_notes: notes,
        rejection_reason: decision === 'rejected' ? notes : null
      })
      .eq('id', verificationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update verification: ${error.message}`);

    // Update individual document statuses if provided
    if (documentReviews && documentReviews.length > 0) {
      for (const review of documentReviews) {
        await supabaseDB
          .from('kyc_documents')
          .update({
            verification_status: review.status,
            verified_by: adminId,
            verification_notes: review.notes,
            verified_at: new Date().toISOString()
          })
          .eq('id', review.documentId);
      }
    }

    return data as KYCVerification;
  }

  // Delete document (mark as deleted, keep audit trail)
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const { data: document, error: docError } = await supabaseDB
      .from('kyc_documents')
      .select('file_path')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (docError) throw new Error(`Failed to fetch document: ${docError.message}`);

    const { error } = await supabaseDB
      .from('kyc_documents')
      .update({ 
        upload_status: 'deleted',
        is_current: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to delete document: ${error.message}`);

    // Delete from storage (optional, based on retention policy)
    if (document?.file_path) {
      await this.storageService.deleteFile(this.KYC_BUCKET, document.file_path);
    }
  }

  // Get KYC status for user
  async getKYCStatus(userId: string): Promise<{
    kycStatus: string;
    isKycVerified: boolean;
    currentVerification?: KYCVerification;
    documents: KYCDocument[];
  }> {
    const { data: profile, error: profileError } = await supabaseDB
      .from('profiles')
      .select('kyc_status, is_kyc_verified, current_kyc_verification_id')
      .eq('id', userId)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

    const documents = await this.getUserKYCDocuments(userId);
    
    let currentVerification = null;
    if (profile.current_kyc_verification_id) {
      const { data: verification } = await supabaseDB
        .from('kyc_verifications')
        .select('*')
        .eq('id', profile.current_kyc_verification_id)
        .single();
      currentVerification = verification;
    }

    return {
      kycStatus: profile.kyc_status,
      isKycVerified: profile.is_kyc_verified,
      currentVerification,
      documents
    };
  }
}