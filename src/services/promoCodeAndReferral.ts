import supabaseDB from "../../config/connectDB";


interface PromoCode {
  id: string;
  code: string;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  max_discount_amount?: number;
  min_order_amount?: number;
  expiry_date: string;
  eligibility: string;
  specific_user_ids?: string[];
  max_usage_count?: number;
  usage_count: number;
  is_active: boolean;
}

interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  referral_code: string;
  reward_amount: number;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
}

export async function getUserReferralCode(userId: string): Promise<string> {
  try {
    const { data: profile, error } = await supabaseDB
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    if (!profile.referral_code) {
      throw new Error('User does not have a referral code');
    }

    return profile.referral_code;
  } catch (error) {
    throw new Error(`Failed to get referral code: ${(error as Error).message}`);
  }
}

// ================================
// 2. GET SHAREABLE REFERRAL LINK
// ================================
export async function getReferralLink(userId: string, baseUrl: string = 'https://yafora.vercel.app'): Promise<string> {
  try {
    const referralCode = await getUserReferralCode(userId);
    return `${baseUrl}/signup?ref=${referralCode}`;
  } catch (error) {
    throw new Error(`Failed to get referral link: ${(error as Error).message}`);
  }
}

// ================================
// 3. VALIDATE REFERRAL CODE FROM LINK
// ================================
export async function validateReferralCode(referralCode: string): Promise<{ 
  isValid: boolean; 
  referrerId?: string; 
  referrerName?: string;
  referrerEmail?: string;
}> {
  try {
    const { data: referrer, error } = await supabaseDB
      .from('profiles')
      .select('id, full_name, email')
      .eq('referral_code', referralCode)
      .single();

    if (error || !referrer) {
      return { isValid: false };
    }

    return {
      isValid: true,
      referrerId: referrer.id,
      referrerName: referrer.full_name,
      referrerEmail: referrer.email
    };
  } catch (error) {
    return { isValid: false };
  }
}

// ================================
// 4. PROCESS REFERRAL ON SIGNUP
// ================================
export async function processReferralSignup(referralCode: string, newUserId: string): Promise<void> {
  try {
    // Validate referral code and get referrer
    const { isValid, referrerId } = await validateReferralCode(referralCode);
    
    if (!isValid || !referrerId) {
      throw new Error('Invalid referral code');
    }

    // Don't allow self-referral
    if (referrerId === newUserId) {
      throw new Error('Cannot refer yourself');
    }

    // Check if this user was already referred
    const { data: existingReferral, error: checkError } = await supabaseDB
      .from('referrals')
      .select('id')
      .eq('referred_id', newUserId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing referral: ${checkError.message}`);
    }

    if (existingReferral) {
      throw new Error('User has already been referred');
    }

    // Create referral record
    const { error: insertError } = await supabaseDB
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_id: newUserId,
        referral_code: referralCode,
        reward_amount: 100, // Configure your reward amount
        status: 'pending',
      });

    if (insertError) {
      throw new Error(`Failed to create referral: ${insertError.message}`);
    }
  } catch (error) {
    throw new Error(`Failed to process referral signup: ${(error as Error).message}`);
  }
}

// ================================
// 5. COMPLETE REFERRAL (GIVE REWARD)
// ================================
export async function completeReferral(referredUserId: string): Promise<{ completed: boolean; reward?: number; referrerId?: string }> {
  try {
    // Find pending referral for this user
    const { data: referral, error: fetchError } = await supabaseDB
      .from('referrals')
      .select('*')
      .eq('referred_id', referredUserId)
      .eq('status', 'pending')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch referral: ${fetchError.message}`);
    }

    if (!referral) {
      // No pending referral found
      return { completed: false };
    }

    // Update referral status to completed
    const { error: updateError } = await supabaseDB
      .from('referrals')
      .update({ status: 'completed' })
      .eq('id', referral.id);

    if (updateError) {
      throw new Error(`Failed to complete referral: ${updateError.message}`);
    }

    return {
      completed: true,
      reward: referral.reward_amount,
      referrerId: referral.referrer_id
    };
  } catch (error) {
    throw new Error(`Failed to complete referral: ${(error as Error).message}`);
  }
}

// ================================
// 6. GET USER'S REFERRAL STATS
// ================================
export async function getReferralStats(userId: string, baseUrl?: string): Promise<{
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  referrals: any[];
}> {
  try {
    // Get user's referral code
    const referralCode = await getUserReferralCode(userId);
    const referralLink = await getReferralLink(userId, baseUrl);

    // Get all referrals with referred user details
    const { data: referrals, error } = await supabaseDB
      .from('referrals')
      .select(`
        *,
        referred_user:profiles!referrals_referred_id_fkey(full_name, email)
      `)
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch referrals: ${error.message}`);
    }

    const completedReferrals = referrals.filter(r => r.status === 'completed');
    const pendingReferrals = referrals.filter(r => r.status === 'pending');
    const totalEarnings = completedReferrals.reduce((sum, r) => sum + r.reward_amount, 0);

    return {
      referralCode,
      referralLink,
      totalReferrals: referrals.length,
      completedReferrals: completedReferrals.length,
      pendingReferrals: pendingReferrals.length,
      totalEarnings,
      referrals
    };
  } catch (error) {
    throw new Error(`Failed to get referral stats: ${(error as Error).message}`);
  }
}

// ================================
// 7. GET REFERRAL COUNT (Your existing function)
// ================================
export async function getReferralCount(userId: string): Promise<number> {
  const { count, error } = await supabaseDB
    .from('referrals')
    .select('id', { count: 'exact' })
    .eq('referrer_id', userId)
    .eq('status', 'completed');

  if (error) {
    throw new Error(`Failed to fetch referral count: ${error.message}`);
  }

  return count || 0;
}

export async function validatePromoCode(code: string, userId: string, orderAmount: number): Promise<PromoCode> {
  const { data: promo, error } = await supabaseDB
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (error || !promo) {
    throw new Error("Invalid or inactive promo code");
  }

  if (new Date(promo.expiry_date) < new Date()) {
    throw new Error("Promo code has expired");
  }

  // Check if it's a referral promo code
  const { data: referralReward, error: referralError } = await supabaseDB
    .from('referral_rewards')
    .select('required_referrals')
    .eq('promo_code_id', promo.id)
    .single();

  if (referralError && referralError.code !== 'PGRST116') { // Ignore if not found
    throw new Error(`Failed to check referral reward: ${referralError.message}`);
  }

  if (referralReward) {
    const referralCount = await getReferralCount(userId);

    if (referralCount < referralReward.required_referrals) {
      throw new Error(`Please refer at least ${referralReward.required_referrals} friends to use this promo code`);
    }

    // Check if already used by this user
    const { data: claim, error: claimError } = await supabaseDB
      .from('promo_code_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('promo_code_id', promo.id)
      .single();

    if (claimError && claimError.code !== 'PGRST116') {
      throw new Error(`Failed to check promo usage: ${claimError.message}`);
    }

    if (claim) {
      throw new Error("You have already used this promo code");
    }
  }

  if (promo.eligibility !== 'all') {
    if (promo.eligibility === 'new_users') {
      const { count } = await supabaseDB
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('buyer_id', userId);
      
      if (count && count > 0) {
        throw new Error("Promo code only valid for new users");
      }
    } else if (promo.eligibility === 'specific_users' && (!promo.specific_user_ids || !promo.specific_user_ids.includes(userId))) {
      throw new Error("Promo code not valid for this user");
    }
  }

  if (promo.min_order_amount && orderAmount < promo.min_order_amount) {
    throw new Error(`Order amount must be at least ₹${promo.min_order_amount}`);
  }

  if (promo.max_usage_count && promo.usage_count >= promo.max_usage_count) {
    throw new Error("Promo code has reached maximum usage");
  }

  return promo;
}

export async function incrementPromoUsage(promoCodeId: string): Promise<void> {
  // Step 1: Fetch current usage_count
  const { data: promo, error: fetchError } = await supabaseDB
    .from('promo_codes')
    .select('usage_count')
    .eq('id', promoCodeId)
    .single();

  if (fetchError || !promo) {
    throw new Error(`Failed to fetch promo code usage: ${fetchError?.message}`);
  }

  // Step 2: Increment locally and update
  const { error: updateError } = await supabaseDB
    .from('promo_codes')
    .update({ usage_count: promo.usage_count + 1 })
    .eq('id', promoCodeId);

  if (updateError) {
    throw new Error(`Failed to update promo code usage: ${updateError.message}`);
  }
}

export async function markPromoAsUsed(userId: string, promoCodeId: string): Promise<void> {
  // Check if it's a referral promo before marking
  const { data: referralReward } = await supabaseDB
    .from('referral_rewards')
    .select('id')
    .eq('promo_code_id', promoCodeId)
    .single();

  if (referralReward) {
    const { error } = await supabaseDB
      .from('promo_code_claims')
      .insert([{ user_id: userId, promo_code_id: promoCodeId }]);

    if (error) {
      throw new Error(`Failed to mark promo as used: ${error.message}`);
    }
  }
}

export async function getUserReferrals(userId: string): Promise<{ referrals: Referral[], total_rewards: number }> {
  const { data, error } = await supabaseDB
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch referrals: ${error.message}`);
  }

  const total_rewards = data
    .filter(referral => referral.status === 'completed')
    .reduce((sum, referral) => sum + referral.reward_amount, 0);

  return { referrals: data, total_rewards };
}

export async function createReferralInvite(referrerId: string, email: string): Promise<Referral> {
  // Generate a unique referral code
  const referralCode = `REF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

  const { data, error } = await supabaseDB
    .from('referrals')
    .insert({
      referrer_id: referrerId,
      referred_id: null,
      referral_code: referralCode,
      reward_amount: 100, // Adjust this based on your reward policy
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create referral: ${error.message}`);
  }

  return data;
}