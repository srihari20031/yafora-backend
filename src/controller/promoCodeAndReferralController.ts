import { Request, Response } from "express";
import { completeReferral, getReferralLink, getReferralStats, getUserReferralCode, processReferralSignup, validatePromoCode, validateReferralCode } from "../services/promoCodeAndReferral";
import { getUserReferrals, createReferralInvite } from "../services/promoCodeAndReferral";

export async function validatePromoCodeController(req: Request, res: Response): Promise<void> {
  try {
    const { code, userId, orderAmount } = req.body;

    if (!code || !userId || !orderAmount) {
      res.status(400).json({ error: "Code, userId, and orderAmount are required" });
      return;
    }

    const promo = await validatePromoCode(code, userId, orderAmount);
    res.status(200).json(promo);
  } catch (error) {
    console.error("Error validating promo code:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function getReferralsController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const { referrals, total_rewards } = await getUserReferrals(userId);
    res.status(200).json({ referrals, total_rewards });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function createReferralInviteController(req: Request, res: Response): Promise<void> {
  try {
    const { referrer_id, email } = req.body;

    if (!referrer_id || !email) {
      res.status(400).json({ error: "Referrer ID and email are required" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    const referral = await createReferralInvite(referrer_id, email);
    res.status(201).json({ referral });
  } catch (error) {
    console.error("Error creating referral invite:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function getReferralLinkController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.userId;
    const baseUrl = 'https://yafora.vercel.app';

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const referralCode = await getUserReferralCode(userId);
    const referralLink = await getReferralLink(userId, baseUrl as string);

    res.status(200).json({ 
      referralLink, 
      referralCode,
      message: "Share this link with your friends!" 
    });
  } catch (error) {
    console.error("Error getting referral link:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function validateReferralController(req: Request, res: Response): Promise<void> {
  try {
    const { referralCode } = req.params;

    if (!referralCode) {
      res.status(400).json({ error: "Referral code is required" });
      return;
    }

    const result = await validateReferralCode(referralCode);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error validating referral:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function processReferralController(req: Request, res: Response): Promise<void> {
  try {
    const { referralCode, newUserId } = req.body;

    if (!referralCode || !newUserId) {
      res.status(400).json({ error: "Referral code and new user ID are required" });
      return;
    }

    await processReferralSignup(referralCode, newUserId);
    res.status(200).json({ message: "Referral processed successfully" });
  } catch (error) {
    console.error("Error processing referral:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function completeReferralController(req: Request, res: Response): Promise<void> {
  try {
    const { referredUserId } = req.body;

    if (!referredUserId) {
      res.status(400).json({ error: "Referred user ID is required" });
      return;
    }

    const result = await completeReferral(referredUserId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error completing referral:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}

export async function getReferralStatsController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.userId;
    const baseUrl = req.query.baseUrl as string;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const stats = await getReferralStats(userId, baseUrl);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error getting referral stats:", error);
    res.status(400).json({ error: (error as Error).message });
  }
}