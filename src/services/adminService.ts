import supabaseDB from "../../config/connectDB";

interface UserUpdate {
  status?: 'suspicious' | 'inactive' | 'verified';
}

interface ProductUpdate {
  status?: 'visible' | 'hidden' | 'rejected';
}

interface OrderUpdate {
  status?: 'pending' | 'accepted' | 'out_for_pickup' | 'picked' | 'delivered' | 'returned' | 'cancelled';
}

interface DamageClaimData {
  action: 'approve' | 'reject';
  amount: number;
}

interface ReferralData {
  referrerId?: string;
  rewardAmount: number;
  referralCode?: string;
  status?: 'active' | 'inactive' | 'expired';
}

interface PromoData {
  code: string;
  discountValue: number;
  expiryDate: string;
  status?: 'active' | 'inactive' | 'expired';
  userEligibility?: string;
}

interface Referral {
id: string
referrer_id: string
referred_id: string | null
referral_code: string
reward_amount: number
status: "pending" | "completed" | "expired"
created_at: string
reward_credited_at: string | null
reward_status: "pending" | "credited" | "redeemed"
}
// interface ReferralData {
// referrer_id: string
// rewardAmount: number
// referral_code: string
// status?: "pending" | "completed" | "expired"
// }


export async function getAllUsers() {
  const { data, error } = await supabaseDB
    .from('profiles')
    .select(`
      *,
      kyc_verifications!current_kyc_verification_id (
        id,
        status,
        submitted_at,
        reviewed_at,
        rejection_reason
      )
    `)
    .in('role', ['buyer', 'seller']);
    
  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
  
  return data;
}

export async function getUserById(userId: string) {
  const { data, error } = await supabaseDB
    .from('profiles')
    .select(`
      *,
      kyc_verification_summary (
        verification_status,
        document_count
      )
    `)
    .eq('id', userId)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // User not found
    }
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
  
  return data;
}

export async function updateUserStatus(userId: string, status: UserUpdate['status']) {
  const validStatuses = ['suspicious', 'inactive', 'verified'];
  if (!status || !validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }
  
  const { data, error } = await supabaseDB
    .from('profiles')
    .update({ kyc_status: status })
    .eq('id', userId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to update user status: ${error.message}`);
  }
  
  return data;
}

export async function getAllProducts() {
  const { data, error } = await supabaseDB
    .from('products')
    .select(`
      *,
      profiles!products_seller_id_fkey (
        email
      )
    `);
    
  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
  
  return data;
}

export async function updateProductStatus(productId: string, status: ProductUpdate['status']) {
  const validStatuses = ['visible', 'hidden', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }
  
  const { data, error } = await supabaseDB
    .from('products')
    .update({ availability_status: status })
    .eq('id', productId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to update product status: ${error.message}`);
  }
  
  return data;
}

export async function getAllOrders() {
  const { data, error } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (
        title
      ),
      buyer:profiles!orders_buyer_id_fkey (
        email
      ),
      seller:profiles!orders_seller_id_fkey (
        email
      )
    `);
    console.log('Fetched orders:', data);
  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }
  
  return data;
}

export async function updateOrderStatus(orderId: string, status: OrderUpdate['status']) {
  const validStatuses = ['pending', 'accepted', 'out_for_pickup', 'picked', 'delivered', 'returned', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }
  
  const { data, error } = await supabaseDB
    .from('orders')
    .update({ delivery_status: status })
    .eq('id', orderId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }
  
  return data;
}

export async function applyLateFee(orderId: string, amount: number) {
  if (amount <= 0) {
    throw new Error('Late fee amount must be positive');
  }
  
  // First get the current late fee
  const { data: currentOrder, error: fetchError } = await supabaseDB
    .from('orders')
    .select('late_fee')
    .eq('id', orderId)
    .single();
    
  if (fetchError) {
    throw new Error(`Failed to fetch current order: ${fetchError.message}`);
  }
  
  const newLateFee = (currentOrder.late_fee || 0) + amount;
  
  const { data, error } = await supabaseDB
    .from('orders')
    .update({ late_fee: newLateFee })
    .eq('id', orderId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to apply late fee: ${error.message}`);
  }
  
  return data;
}

export async function handleDamageClaim(orderId: string, damageData: DamageClaimData) {
  const { action, amount } = damageData;
  
  if (!['approve', 'reject'].includes(action)) {
    throw new Error('Invalid action');
  }
  
  const damageFee = action === 'approve' ? amount : 0;
  
  const { data, error } = await supabaseDB
    .from('orders')
    .update({ damage_fee: damageFee })
    .eq('id', orderId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to handle damage claim: ${error.message}`);
  }
  
  return data;
}

export async function getSellerEarnings(sellerId: string) {
  const { data, error } = await supabaseDB
    .rpc('get_seller_earnings', { seller_id: sellerId });

  if (error) {
    throw new Error(`Failed to fetch seller earnings: ${error.message}`);
  }

  return data[0] || {
    total_earnings: 0,
    total_orders: 0,
    completed_orders: 0,
    commission_deducted: 0
  };
}
export async function updatePlatformCommission(productId: string, commission: number) {
  if (commission < 0 || commission > 100) {
    throw new Error('Invalid commission percentage');
  }
  
  const { data, error } = await supabaseDB
    .from('products')
    .update({ security_deposit_percentage: commission })
    .eq('id', productId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to update platform commission: ${error.message}`);
  }
  
  return data;
}

export async function processWithdrawalRequest(paymentId: string, status: 'processing' | 'paid') {
  const validStatuses = ['processing', 'paid'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }
  
  const { data, error } = await supabaseDB
    .from('payments')
    .update({ payment_status: status })
    .eq('id', paymentId)
    .eq('payment_type', 'withdrawal')
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to process withdrawal request: ${error.message}`);
  }
  
  return data;
}

export async function manageReferralProgram(
  action: 'create' | 'update',
  referralId?: string,
  referralData?: ReferralData
) {
  if (action === 'create' && referralData) {
    const { referrerId, rewardAmount, referralCode } = referralData;
    
    const { data, error } = await supabaseDB
      .from('referrals')
      .insert([{
        referrer_id: referrerId,
        referral_code: referralCode,
        reward_amount: rewardAmount,
        status: 'active'
      }])
      .select()
      .single();
      
    if (error) {
      throw new Error(`Failed to create referral: ${error.message}`);
    }
    
    return data;
  } else if (action === 'update' && referralId && referralData) {
    const { data, error } = await supabaseDB
      .from('referrals')
      .update({
        reward_amount: referralData.rewardAmount,
        status: referralData.status
      })
      .eq('id', referralId)
      .select()
      .single();
      
    if (error) {
      throw new Error(`Failed to update referral: ${error.message}`);
    }
    
    return data;
  } else {
    throw new Error('Invalid action or missing data');
  }
}

export async function getAllReferrals(): Promise<Referral[]> {
  const { data, error } = await supabaseDB
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch referrals: ${error.message}`);
  }

  return data;
}

export async function managePromoCode(action: 'create' | 'update', promoData: PromoData) {
  if (action === 'create') {
    const { code, discountValue, expiryDate } = promoData;
    
    const { data, error } = await supabaseDB
      .from('referrals') // Assuming promo codes are stored in referrals table
      .insert([{
        referral_code: code,
        reward_amount: discountValue,
        status: 'active',
        expiry_date: expiryDate
      }])
      .select()
      .single();
      
    if (error) {
      throw new Error(`Failed to create promo code: ${error.message}`);
    }
    
    return data;
  } else if (action === 'update') {
    const { code, discountValue, expiryDate, status } = promoData;
    
    const { data, error } = await supabaseDB
      .from('referrals')
      .update({
        reward_amount: discountValue,
        status: status || 'active',
        expiry_date: expiryDate
      })
      .eq('referral_code', code)
      .select()
      .single();
      
    if (error) {
      throw new Error(`Failed to update promo code: ${error.message}`);
    }
    
    return data;
  } else {
    throw new Error('Invalid action');
  }
}

export async function assignDelivery(orderId: string, deliveryPartnerId: string) {
  const { data, error } = await supabaseDB
    .from('orders')
    .update({ 
      delivery_status: 'accepted',
      delivery_partner_id: deliveryPartnerId
    })
    .eq('id', orderId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to assign delivery: ${error.message}`);
  }
  
  return data;
}

export async function getMissedPickups() {
  const { data, error } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (
        title
      ),
      buyer:profiles!orders_buyer_id_fkey (
        email
      )
    `)
    .eq('delivery_status', 'pending')
    .lt('rental_start_date', new Date().toISOString());
    
  if (error) {
    throw new Error(`Failed to fetch missed pickups: ${error.message}`);
  }
  
  return data;
}

export async function createPromoCode(promoData: {
  code: string;
  description?: string;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  max_discount_amount?: number;
  min_order_amount?: number;
  expiry_date: Date;
  eligibility: 'all' | 'new_users' | 'buyers' | 'sellers' | 'specific_users';
  specific_user_ids?: string[];
  max_usage_count?: number;
}): Promise<any> {
  const { data, error } = await supabaseDB
    .from('promo_codes')
    .insert([{
      code: promoData.code,
      description: promoData.description,
      discount_type: promoData.discount_type,
      discount_value: promoData.discount_value,
      max_discount_amount: promoData.max_discount_amount,
      min_order_amount: promoData.min_order_amount,
      expiry_date: promoData.expiry_date.toISOString(),
      eligibility: promoData.eligibility,
      specific_user_ids: promoData.specific_user_ids,
      max_usage_count: promoData.max_usage_count,
      usage_count: 0,
      is_active: true,
    }])
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to create promo code: ${error.message}`);
  }
  
  return data;
}

export async function updatePromoCode(promoId: string, promoData: {
  code?: string;
  description?: string;
  discount_type?: 'flat' | 'percentage';
  discount_value?: number;
  max_discount_amount?: number;
  min_order_amount?: number;
  expiry_date?: Date;
  eligibility?: 'all' | 'new_users' | 'buyers' | 'sellers' | 'specific_users';
  specific_user_ids?: string[];
  max_usage_count?: number;
  is_active?: boolean;
}): Promise<any> {
  const updateData: any = {};
  
  if (promoData.code !== undefined) updateData.code = promoData.code;
  if (promoData.description !== undefined) updateData.description = promoData.description;
  if (promoData.discount_type !== undefined) updateData.discount_type = promoData.discount_type;
  if (promoData.discount_value !== undefined) updateData.discount_value = promoData.discount_value;
  if (promoData.max_discount_amount !== undefined) updateData.max_discount_amount = promoData.max_discount_amount;
  if (promoData.min_order_amount !== undefined) updateData.min_order_amount = promoData.min_order_amount;
  if (promoData.expiry_date !== undefined) updateData.expiry_date = promoData.expiry_date.toISOString();
  if (promoData.eligibility !== undefined) updateData.eligibility = promoData.eligibility;
  if (promoData.specific_user_ids !== undefined) updateData.specific_user_ids = promoData.specific_user_ids;
  if (promoData.max_usage_count !== undefined) updateData.max_usage_count = promoData.max_usage_count;
  if (promoData.is_active !== undefined) updateData.is_active = promoData.is_active;
  
  const { data, error } = await supabaseDB
    .from('promo_codes')
    .update(updateData)
    .eq('id', promoId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to update promo code: ${error.message}`);
  }
  
  return data;
}

export async function getAllPromoCodes(): Promise<any[]> {
  const { data, error } = await supabaseDB
    .from('promo_codes')
    .select('*')
    .eq('is_active', true);
    
  if (error) {
    throw new Error(`Failed to fetch promo codes: ${error.message}`);
  }
  
  return data || [];
}

export async function applyPromoCode(orderId: string, promoCode: string, userId: string): Promise<any> {
  // First, get the promo code details
  const { data: promo, error: promoError } = await supabaseDB
    .from('promo_codes')
    .select('*')
    .eq('code', promoCode)
    .single();
    
  if (promoError || !promo) {
    throw new Error('Invalid promo code');
  }
  
  if (!promo.is_active || (promo.expiry_date && new Date(promo.expiry_date) < new Date())) {
    throw new Error('Invalid or expired promo code');
  }
  
  if (promo.max_usage_count && promo.usage_count >= promo.max_usage_count) {
    throw new Error('Promo code usage limit reached');
  }
  
  // Check user eligibility
  if (promo.eligibility !== 'all') {
    const { data: user, error: userError } = await supabaseDB
      .from('profiles')
      .select('created_at, role')
      .eq('id', userId)
      .single();
      
    if (userError) {
      throw new Error('User not found');
    }
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    if (
      (promo.eligibility === 'new_users' && new Date(user.created_at) < thirtyDaysAgo) ||
      (promo.eligibility === 'buyers' && user.role !== 'buyer') ||
      (promo.eligibility === 'sellers' && user.role !== 'seller') ||
      (promo.eligibility === 'specific_users' && !promo.specific_user_ids?.includes(userId))
    ) {
      throw new Error('User not eligible for this promo code');
    }
  }
  
  // Get order details
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select('total_amount')
    .eq('id', orderId)
    .single();
    
  if (orderError || !order) {
    throw new Error('Order not found');
  }
  
  if (promo.min_order_amount && order.total_amount < promo.min_order_amount) {
    throw new Error('Order amount does not meet minimum requirement');
  }
  
  // Calculate discount
  let discountAmount = promo.discount_type === 'flat' 
    ? promo.discount_value 
    : (promo.discount_value * order.total_amount) / 100;
    
  if (promo.max_discount_amount && discountAmount > promo.max_discount_amount) {
    discountAmount = promo.max_discount_amount;
  }
  
  // Update order with promo code
  const { data: updatedOrder, error: updateError } = await supabaseDB
    .from('orders')
    .update({
      promo_code_id: promo.id,
      discount_amount: discountAmount,
      total_amount: order.total_amount - discountAmount,
    })
    .eq('id', orderId)
    .select()
    .single();
    
  if (updateError) {
    throw new Error(`Failed to apply promo code: ${updateError.message}`);
  }
  
  // Update promo code usage count
  const { error: usageError } = await supabaseDB
    .from('promo_codes')
    .update({ usage_count: promo.usage_count + 1 })
    .eq('id', promo.id);
    
  if (usageError) {
    throw new Error(`Failed to update promo code usage: ${usageError.message}`);
  }
  
  return updatedOrder;
}

export async function getPlatformCommissions() {
  const { data, error } = await supabaseDB
    .from('platform_commissions')
    .select(`
      id,
      product_id,
      commission_percentage,
      products!platform_commissions_product_id_fkey (
        title
      )
    `);

  if (error) {
    throw new Error(`Failed to fetch platform commissions: ${error.message}`);
  }

  return data;
}

export async function processSecurityDeposit(
  orderId: string,
  action: 'release' | 'partial_refunded' | 'forfeited',
  refundAmount: number = 0
) {
  if (action === 'partial_refunded' && refundAmount <= 0) {
    throw new Error('Refund amount must be positive for partial refunds');
  }

  const { data: order, error: fetchError } = await supabaseDB
    .from('orders')
    .select('security_deposit, security_deposit_status')
    .eq('id', orderId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch order: ${fetchError.message}`);
  }

  if (action === 'partial_refunded' && refundAmount > order.security_deposit) {
    throw new Error('Refund amount cannot exceed security deposit');
  }

  const updateData: any = {
    security_deposit_status: action,
    security_deposit_refunded_amount: action === 'release' ? order.security_deposit : refundAmount,
    security_deposit_released_at: new Date().toISOString()
  };

  const { data, error } = await supabaseDB
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to process security deposit: ${error.message}`);
  }

  return data;
}

export async function getSecurityDeposits(statusFilter?: string) {
  const query = supabaseDB
    .from('orders')
    .select(`
      id,
      security_deposit,
      security_deposit_status,
      security_deposit_refunded_amount,
      security_deposit_released_at,
      payment_status,
      buyer:profiles!orders_buyer_id_fkey (
        email,
        full_name
      ),
      products (
        title
      )
    `)
    .gt('security_deposit', 0);

  if (statusFilter) {
    query.eq('security_deposit filter', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch security deposits: ${error.message}`);
  }

  return data;
}

export async function getWithdrawalRequests(statusFilter?: 'pending' | 'processing' | 'paid') {
  const query = supabaseDB
    .from('payments')
    .select(`
      id,
      user_id,
      amount,
      payment_status,
      created_at,
      profiles!payments_user_id_fkey (
        email,
        full_name
      )
    `)
    .eq('payment_type', 'withdrawal');

  if (statusFilter) {
    query.eq('payment_status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch withdrawal requests: ${error.message}`);
  }

  return data;
}

export async function getGlobalCommission() {
  const { data, error } = await supabaseDB
    .from("platform_commissions")
    .select("*")
    .eq("is_global", true)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 means "no rows found"
    throw new Error(`Failed to fetch global commission: ${error.message}`);
  }

  return data;
}

// Create a new commission
export async function createCommission(
  commissionPercentage: number,
  productId: string | null,
  isGlobal: boolean
) {
  const { data, error } = await supabaseDB
    .from("platform_commissions")
    .insert({
      commission_percentage: commissionPercentage,
      product_id: productId,
      is_global: isGlobal,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create commission: ${error.message}`)
  }

  let productTitle: string | null = null
  if (productId) {
    const { data: product, error: productError } = await supabaseDB
      .from("products")
      .select("title")
      .eq("id", productId)
      .single()

    if (productError) {
      console.warn(`Error fetching product title: ${productError.message}`)
    } else {
      productTitle = product?.title || null
    }
  }

  return {
    ...data,
    product_title: productTitle,
  }
}


// Update an existing commission
export async function updateCommission(
  commissionId: string,
  commissionPercentage: number,
  productId: string | null,
) {
  const { data, error } = await supabaseDB
    .from("platform_commissions")
    .update({
      commission_percentage: commissionPercentage,
      product_id: productId,
    })
    .eq("id", commissionId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update commission: ${error.message}`)
  }

  let productTitle: string | null = null
  if (productId) {
    const { data: product, error: productError } = await supabaseDB
      .from("products")
      .select("title")
      .eq("id", productId)
      .single()

    if (productError) {
      console.warn(`Error fetching product title: ${productError.message}`)
    } else {
      productTitle = product?.title || null
    }
  }

  return {
    ...data,
    product_title: productTitle,
  }
}


// Delete a commission
export async function deleteCommission(commissionId: string) {
  const { error } = await supabaseDB
    .from("platform_commissions")
    .delete()
    .eq("id", commissionId);

  if (error) {
    throw new Error(`Failed to delete commission: ${error.message}`);
  }
}

// Fetch all commissions
export async function getCommissions() {
  const { data, error } = await supabaseDB
    .from("platform_commissions")
    .select(`
      id,
      commission_percentage,
      product_id,
      is_global,
      created_at,
      products!platform_commissions_product_id_fkey (title)
    `)
  
  if (error) {
    throw new Error(`Failed to fetch commissions: ${error.message}`)
  }
  
  return data.map((commission) => ({
    id: commission.id,
    commission_percentage: commission.commission_percentage,
    product_id: commission.product_id,
    is_global: commission.is_global,
    created_at: commission.created_at,
    product_title: commission.products?.[0]?.title || null,
  }))
}

export async function getAllReferralRewards(): Promise<any[]> {
  const { data, error } = await supabaseDB
    .from('referral_rewards')
    .select(`
      *,
      promo_codes (
        code,
        discount_type,
        discount_value,
        expiry_date
      )
    `)
    .order('required_referrals', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch referral rewards: ${error.message}`);
  }

  return data;
}

export async function createReferralReward(rewardData: {
  required_referrals: number;
  promo_code_id: string;
  description?: string;
  is_active?: boolean;
}): Promise<any> {
  if (rewardData.required_referrals <= 0) {
    throw new Error('Required referrals must be positive');
  }

  // Verify the promo exists
  const { data: promo, error: promoError } = await supabaseDB
    .from('promo_codes')
    .select('id')
    .eq('id', rewardData.promo_code_id)
    .single();

  if (promoError || !promo) {
    throw new Error('Invalid promo code ID');
  }

  const { data, error } = await supabaseDB
    .from('referral_rewards')
    .insert([rewardData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create referral reward: ${error.message}`);
  }

  return data;
}

export async function updateReferralReward(rewardId: string, rewardData: Partial<{
  required_referrals: number;
  promo_code_id: string;
  description?: string;
  is_active?: boolean;
}>): Promise<any> {
  const { data, error } = await supabaseDB
    .from('referral_rewards')
    .update(rewardData)
    .eq('id', rewardId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update referral reward: ${error.message}`);
  }

  return data;
}

export async function deleteReferralReward(rewardId: string): Promise<void> {
  const { error } = await supabaseDB
    .from('referral_rewards')
    .delete()
    .eq('id', rewardId);

  if (error) {
    throw new Error(`Failed to delete referral reward: ${error.message}`);
  }
}