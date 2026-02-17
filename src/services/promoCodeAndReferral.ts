import supabaseDB from "../../config/connectDB";
import { sendHtmlEmail } from "../../utils/sendEmail";



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
export async function getReferralLink(userId: string, baseUrl: string = 'https://rent.yafora.com'): Promise<string> {
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
export async function processReferralSignup(
  referralCode: string, 
  newUserId: string,
  userEmail: string  // 🔑 passed directly from signup, no profile lookup
): Promise<void> {
  try {
    const { isValid, referrerId } = await validateReferralCode(referralCode);
    
    if (!isValid || !referrerId) {
      throw new Error('Invalid referral code');
    }

    if (referrerId === newUserId) {
      throw new Error('Cannot refer yourself');
    }

    // Check if already referred
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

    // 🔑 Check if an email invite exists for this email + referral code
    // (profile may not exist yet — so we use the email from signup payload directly)
    const { data: emailInvite } = await supabaseDB
      .from('referrals')
      .select('id')
      .eq('referral_code', referralCode)
      .eq('invited_email', userEmail)
      .eq('status', 'pending')
      .is('referred_id', null)
      .single();

    if (emailInvite) {
      // ✅ Email invite found — update it, don't create a new record
      const { error: updateError } = await supabaseDB
        .from('referrals')
        .update({ referred_id: newUserId })
        .eq('id', emailInvite.id);

      if (updateError) {
        throw new Error(`Failed to update referral: ${updateError.message}`);
      }

      console.log(`✅ Linked email invite to new user ${newUserId}`);
      return;
    }

    // No email invite found — organic signup via shared link, create new record
    const { error: insertError } = await supabaseDB
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_id: newUserId,
        referral_code: referralCode,
        reward_amount: 100,
        status: 'pending',
      });

    if (insertError) {
      throw new Error(`Failed to create referral: ${insertError.message}`);
    }

    console.log(`✅ Created new referral for organic signup ${newUserId}`);
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

    // Transform referrals to match frontend expectations
   const transformedReferrals = referrals.map(referral => ({
  id: referral.id,
  referred_user_email: referral.referred_user?.email || referral.invited_email || 'Unknown', // ✅
  referred_user_id: referral.referred_id,
  status: referral.status === 'completed' ? 'rewarded' : referral.status,
  reward_amount: referral.reward_amount,
  created_at: referral.created_at,
  completed_at: referral.completed_at
}));

    return {
      referralCode,
      referralLink,
      totalReferrals: referrals.length,
      completedReferrals: completedReferrals.length,
      pendingReferrals: pendingReferrals.length,
      totalEarnings,
      referrals: transformedReferrals
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
  // Get referrer's profile
  const { data: referrer, error: profileError } = await supabaseDB
    .from('profiles')
    .select('full_name, referral_code')
    .eq('id', referrerId)
    .single();

  if (profileError || !referrer) {
    throw new Error('Referrer profile not found');
  }

  // 🔑 FIX 1: Check if email already exists in profiles (already registered)
  const { data: existingUser } = await supabaseDB
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new Error('This email is already registered on Yafora');
  }

  // 🔑 FIX 2: Check if this email was already invited with this referral code
  const { data: existingInvite } = await supabaseDB
    .from('referrals')
    .select('id')
    .eq('referral_code', referrer.referral_code)
    .eq('invited_email', email)
    .single();

  if (existingInvite) {
    throw new Error('You have already sent an invitation to this email');
  }

  const referralLink = `https://rent.yafora.com/signup?ref=${referrer.referral_code}`;
  const referrerName = referrer.full_name || 'Your friend';

  await sendHtmlEmail(
    email,
    `${referrerName} invited you to join Yafora! 🎉`,
    generateReferralInviteHtml(referrerName, referralLink),
    `${referrerName} invited you to Yafora! Sign up here: ${referralLink}`
  );

  const { data, error } = await supabaseDB
    .from('referrals')
    .insert({
      referrer_id: referrerId,
      referred_id: null,
      referral_code: referrer.referral_code,
      invited_email: email,
      reward_amount: 100,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create referral: ${error.message}`);
  }

  return data;
}

function generateReferralInviteHtml(referrerName: string, referralLink: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to Yafora!</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0; padding: 0;
          background-color: #F9FAFB;
          color: #111827;
        }
        .container {
          max-width: 640px; margin: 20px auto;
          background-color: #FFFFFF;
          border-radius: 12px; overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #670D2F 0%, #A53860 100%);
          padding: 40px 24px; text-align: center;
        }
        .logo { font-size: 30px; font-weight: 700; color: #FFFFFF; margin: 0; }
        .header-subtitle { color: #EF88AD; font-size: 16px; margin: 8px 0 0; }
        .content { padding: 32px 28px; }
        .gift-icon {
          font-size: 48px; text-align: center; margin-bottom: 16px;
        }
        h2 { font-size: 22px; font-weight: 600; color: #111827; text-align: center; margin-bottom: 12px; }
        p { margin: 0 0 16px; line-height: 1.6; font-size: 15px; color: #374151; }
        .highlight-box {
          background: #FFF1F2; border-left: 4px solid #A53860;
          padding: 16px; border-radius: 8px; margin: 20px 0;
          font-size: 15px; color: #374151;
        }
        .reward-badge {
          background: linear-gradient(135deg, #16a34a, #15803d);
          color: white; text-align: center;
          padding: 16px; border-radius: 10px; margin: 20px 0;
        }
        .reward-badge .amount { font-size: 32px; font-weight: 700; }
        .reward-badge .label { font-size: 13px; opacity: 0.9; margin-top: 4px; }
        .button {
          display: block; padding: 16px 28px;
          background: linear-gradient(135deg, #670D2F 0%, #A53860 100%);
          color: #FFFFFF !important; text-decoration: none;
          border-radius: 8px; font-weight: 600; font-size: 16px;
          text-align: center; margin: 24px 0;
        }
        .steps {
          background: #F9FAFB; border-radius: 8px;
          padding: 16px 20px; margin: 20px 0;
        }
        .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; font-size: 14px; }
        .step:last-child { margin-bottom: 0; }
        .step-number {
          background: #670D2F; color: white;
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
          line-height: 22px; text-align: center;
        }
        .footer {
          background: #F9FAFB; padding: 24px; text-align: center;
          font-size: 14px; color: #6B7280;
          border-top: 1px solid #E5E7EB;
        }
        @media (max-width: 640px) {
          .container { margin: 10px; }
          .content { padding: 24px 16px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">Yafora</h1>
          <p class="header-subtitle">Elegant Rentals, Memorable Moments</p>
        </div>

        <div class="content">
          <div class="gift-icon">🎁</div>
          <h2>You've Been Invited!</h2>

          <div class="highlight-box">
            <strong>${referrerName}</strong> thinks you'd love Yafora — the easiest way to rent anything you need for life's special moments.
          </div>

          <div class="reward-badge">
            <div class="amount">₹100</div>
            <div class="label">Reward waiting for you on your first rental!</div>
          </div>

          <p style="text-align:center; color:#6B7280; font-size:14px;">Here's how it works:</p>
          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <span>Sign up using <strong>${referrerName}</strong>'s referral link below</span>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <span>Browse and complete your first rental on Yafora</span>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <span>Both you and <strong>${referrerName}</strong> earn rewards! 🎉</span>
            </div>
          </div>

          <a href="${referralLink}" class="button">
            Join Yafora & Claim Your Reward →
          </a>

          <p style="font-size:13px; color:#9CA3AF; text-align:center;">
            Or copy this link: <a href="${referralLink}" style="color:#670D2F;">${referralLink}</a>
          </p>
        </div>

        <div class="footer">
          <p>Best regards,<br><strong>Team Yafora</strong></p>
          <p style="margin-top:12px;">
            Questions? Contact us at <a href="mailto:info@yafora.com" style="color:#670D2F;">info@yafora.com</a>
          </p>
          <p style="font-size:12px; color:#9CA3AF; margin-top:12px;">
            You received this because ${referrerName} entered your email. If this was a mistake, you can ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}