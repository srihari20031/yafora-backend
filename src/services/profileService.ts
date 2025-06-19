import supabaseDB from "../../config/connectDB";


export interface ProfileData {
  full_name?: string;
  phone_number?: string;
  profile_picture_url?: string;
  pickup_address?: any;
  delivery_address?: any;
}

export interface KYCDocuments {
  pan?: string;
  aadhar?: string;
  other_documents?: string[];
}

export interface BankDetails {
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id?: string;
}

export async function getProfileById(userId: string) {
  const { data, error } = await supabaseDB
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Profile not found: ${error.message}`);
  }

  return data;
}

export async function updateProfile(userId: string, profileData: ProfileData) {
  const { data, error } = await supabaseDB
    .from('profiles')
    .update({
      ...profileData,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data;
}

export async function updateKYCDocuments(userId: string, documents: KYCDocuments) {
  const { data, error } = await supabaseDB
    .from('profiles')
    .update({
      kyc_documents: documents,
      kyc_status: 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update KYC documents: ${error.message}`);
  }

  return data;
}

export async function updateBankDetails(userId: string, bankDetails: BankDetails) {
  const { data, error } = await supabaseDB
    .from('profiles')
    .update({
      bank_details: bankDetails,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update bank details: ${error.message}`);
  }

  return data;
}

export async function getKYCStatus(userId: string) {
  const { data, error } = await supabaseDB
    .from('profiles')
    .select('kyc_status, is_kyc_verified, kyc_documents')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get KYC status: ${error.message}`);
  }

  return data;
}