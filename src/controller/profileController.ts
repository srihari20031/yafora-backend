import { Request, Response } from 'express';
import {   getProfileById, 
  updateProfile, 
  updateKYCDocuments, 
  updateBankDetails,
  getKYCStatus,  } from '../services/profileService';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  
  try {
    const profile = await getProfileById(userId);
    res.status(200).json({ profile });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}

export async function updateUserProfile(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const profileData = req.body;
  
  try {
    const updatedProfile = await updateProfile(userId, profileData);
    res.status(200).json({ 
      message: 'Profile updated successfully', 
      profile: updatedProfile 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function submitKYCDocuments(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { documents } = req.body;
  
  try {
    const updatedProfile = await updateKYCDocuments(userId, documents);
    res.status(200).json({ 
      message: 'KYC documents submitted successfully', 
      profile: updatedProfile 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function updateUserBankDetails(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const bankDetails = req.body;
  
  try {
    const updatedProfile = await updateBankDetails(userId, bankDetails);
    res.status(200).json({ 
      message: 'Bank details updated successfully', 
      profile: updatedProfile 
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getUserKYCStatus(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  
  try {
    const kycStatus = await getKYCStatus(userId);
    res.status(200).json({ kycStatus });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}