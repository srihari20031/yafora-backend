import supabaseDB from "../../config/connectDB";
import { StorageService } from "./kycStorage";

// types/kyc.ts
export interface KYCDocument {
  id: string;
  userId: string;
  documentType: 'pan_card' | 'aadhar_card' | 'driving_license'; // removed passport, bank_statement
  idNumber: string;                    // NEW
  submittedAsRole: 'buyer' | 'seller'; // NEW
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
  mimeType: string;
  expiresIn: number;
  documentInfo: Partial<KYCDocument>;
}

// Role-based allowed document types
const ALLOWED_DOCUMENT_TYPES: Record<string, string[]> = {
  buyer: ['aadhar_card', 'pan_card', 'driving_license'],
  seller: ['aadhar_card', 'pan_card'],
};

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
    mimeType: string,
    idNumber: string,                     // NEW
    submittedAsRole: 'buyer' | 'seller'   // NEW
  ): Promise<SignedUrlResponse> {

    // NEW: Validate role
    if (!ALLOWED_DOCUMENT_TYPES[submittedAsRole]) {
      throw new Error(`Invalid role '${submittedAsRole}'. Must be 'buyer' or 'seller'.`);
    }

    // NEW: Validate document type is allowed for this role
    if (!ALLOWED_DOCUMENT_TYPES[submittedAsRole].includes(documentType)) {
      throw new Error(
        `Document type '${documentType}' is not allowed for role '${submittedAsRole}'. ` +
        `Allowed types: ${ALLOWED_DOCUMENT_TYPES[submittedAsRole].join(', ')}`
      );
    }

    // NEW: Validate id_number is not empty
    if (!idNumber || idNumber.trim() === '') {
      throw new Error('ID number is required');
    }

    const baseFileKey = `${userId}/${documentType}/${Date.now()}-${fileName}`;

    const uploadUrl = await this.storageService.generatePresignedUploadUrl(
      this.KYC_BUCKET,
      baseFileKey,
      mimeType,
      3600
    );
    const fileKey = baseFileKey;

    const { data, error } = await supabaseDB
      .from('kyc_documents')
      .insert({
        user_id: userId,
        document_type: documentType,
        document_name: fileName,
        file_path: fileKey,
        file_size: fileSize,
        mime_type: mimeType,
        id_number: idNumber,                  // NEW
        submitted_as_role: submittedAsRole,   // NEW
        upload_status: 'pending',
        is_current: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create document record: ${error.message}`);

    return {
      uploadUrl,
      fileKey,
      expiresIn: 3600,
    };
  }

  // Confirm document upload
  async confirmDocumentUpload(userId: string, fileKey: string): Promise<KYCDocument> {
    const fileExists = await this.storageService.fileExists(this.KYC_BUCKET, fileKey);
    if (!fileExists) throw new Error('File not found in storage');

    const { data, error } = await supabaseDB
      .from('kyc_documents')
      .update({
        upload_status: 'uploaded',
        is_current: true,
        updated_at: new Date().toISOString(),
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
  ): Promise<{ signedUrl: string; mimeType: string; expiresIn: number; documentInfo: Partial<KYCDocument> }> {
    const { data: document, error } = await supabaseDB
      .from('kyc_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) throw new Error(`Document not found: ${error.message}`);

    if (requestorRole === 'user' && document.user_id !== userId) {
      throw new Error('Unauthorized access to document');
    }

    const signedUrl = await this.storageService.generatePresignedDownloadUrl(
      this.KYC_BUCKET,
      document.file_path,
      3600
    );

    return {
      signedUrl,
      mimeType: document.mime_type || 'application/pdf',
      expiresIn: 3600,
      documentInfo: {
        id: document.id,
        documentType: document.document_type,
        documentName: document.document_name,
        verificationStatus: document.verification_status,
        createdAt: document.created_at,
      },
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
        document_ids: documentIds,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create KYC verification: ${error.message}`);
    return data as KYCVerification;
  }

  // Submit KYC for verification
  async submitKYCVerification(userId: string, documentIds: string[]): Promise<KYCVerification> {
    // Check if there's already a pending/submitted verification
    const { data: existingVerification, error: existingError } = await supabaseDB
      .from('kyc_verifications')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['submitted', 'under_review', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingError) {
      throw new Error(`Failed to check existing verification: ${existingError.message}`);
    }

    if (existingVerification && existingVerification.length > 0) {
      const status = existingVerification[0].status;
      throw new Error(`KYC verification already ${status}. Cannot submit duplicate request.`);
    }

    // Check current profile KYC status
    const { data: profile, error: profileError } = await supabaseDB
      .from('profiles')
      .select('kyc_status')
      .eq('id', userId)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

    if (['submitted', 'under_review', 'approved'].includes(profile.kyc_status)) {
      throw new Error(`KYC status is already ${profile.kyc_status}. Cannot submit new verification.`);
    }

    // Validate all documents are uploaded
    const { data: documents, error: docError } = await supabaseDB
      .from('kyc_documents')
      .select('id, upload_status')
      .in('id', documentIds)
      .eq('user_id', userId);

    if (docError) throw new Error(`Failed to validate documents: ${docError.message}`);

    const notUploadedDocs = documents?.filter((doc) => doc.upload_status !== 'uploaded');
    if (notUploadedDocs && notUploadedDocs.length > 0) {
      throw new Error('All documents must be uploaded before submission');
    }

    const verification = await this.createKYCVerification(userId, documentIds, 'initial');

    const { error: profileUpdateError } = await supabaseDB
      .from('profiles')
      .update({
        kyc_status: 'submitted',
        current_kyc_verification_id: verification.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileUpdateError) {
      throw new Error(`Failed to update profile status: ${profileUpdateError.message}`);
    }

    return verification;
  }

  // Admin: Get pending KYC verifications
  async getPendingKYCVerifications(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const { data: verifications, error: verificationError } = await supabaseDB
        .from('kyc_verification_summary')
        .select('*')
        .eq('verification_status', 'submitted')
        .order('submitted_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (verificationError) {
        throw new Error(`Failed to fetch pending verifications: ${verificationError.message}`);
      }

      if (!verifications || verifications.length === 0) return [];

      const verificationsWithDocuments = await Promise.all(
        verifications.map(async (verification) => {
          const { data: documents, error: documentsError } = await supabaseDB
            .from('kyc_documents')
            .select(`
              id, user_id, document_type, document_name, file_path,
              file_size, mime_type, upload_status, verification_status,
              verified_by, verification_notes, expiry_date, is_current,
              id_number, submitted_as_role,
              created_at, updated_at, verified_at
            `)
            .eq('user_id', verification.user_id)
            .eq('upload_status', 'uploaded')
            .eq('is_current', true)
            .order('created_at', { ascending: false });

          if (documentsError) {
            console.error('Error fetching documents for verification:', documentsError);
          }

          return {
            ...verification,
            documents: documents || [],
          };
        })
      );

      return verificationsWithDocuments;
    } catch (error) {
      console.error('Error in getPendingKYCVerifications:', error);
      throw error;
    }
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
        rejection_reason: decision === 'rejected' ? notes : null,
      })
      .eq('id', verificationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update verification: ${error.message}`);

    if (documentReviews && documentReviews.length > 0) {
      for (const review of documentReviews) {
        await supabaseDB
          .from('kyc_documents')
          .update({
            verification_status: review.status,
            verified_by: adminId,
            verification_notes: review.notes,
            verified_at: new Date().toISOString(),
          })
          .eq('id', review.documentId);
      }
    }

    return data as KYCVerification;
  }

  // Delete document
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to delete document: ${error.message}`);

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
    adminNotes?: string;
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
      adminNotes: currentVerification?.admin_notes,
      documents,
    };
  }

  async getUserProfile(userId: string) {
    const { data, error } = await supabaseDB
      .from('profiles')
      .select('full_name, email, kyc_status, is_kyc_verified')
      .eq('id', userId)
      .single();
    if (error) throw new Error(`Failed to fetch user profile: ${error.message}`);
    return data;
  }

  // NEW: Block a buyer
  async blockUser(
    userId: string,
    adminId: string,
    reason: string
  ): Promise<void> {
    const { error } = await supabaseDB
      .from('profiles')
      .update({
        is_blocked: true,
        blocked_reason: reason,
        blocked_at: new Date().toISOString(),
        blocked_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('role', 'buyer'); // Safety: only buyers can be blocked via this method

    if (error) throw new Error(`Failed to block user: ${error.message}`);
  }

  // NEW: Unblock a buyer
  async unblockUser(userId: string): Promise<void> {
    const { error } = await supabaseDB
      .from('profiles')
      .update({
        is_blocked: false,
        blocked_reason: null,
        blocked_at: null,
        blocked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw new Error(`Failed to unblock user: ${error.message}`);
  }
}