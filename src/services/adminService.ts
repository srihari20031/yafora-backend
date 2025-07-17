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
    // If RPC doesn't exist, fall back to manual calculation
    const { data: orders, error: ordersError } = await supabaseDB
      .from('orders')
      .select('total_rental_price, payment_status, delivery_status')
      .eq('seller_id', sellerId);
      
    if (ordersError) {
      throw new Error(`Failed to fetch seller earnings: ${ordersError.message}`);
    }
    
    const earnings = orders.reduce((acc, order) => {
      if (order.payment_status === 'completed') {
        acc.total_earnings += order.total_rental_price || 0;
      }
      acc.total_orders++;
      if (order.delivery_status === 'delivered') {
        acc.completed_orders++;
      }
      return acc;
    }, { total_earnings: 0, total_orders: 0, completed_orders: 0 });
    
    return earnings;
  }
  
  return data;
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

export async function getSecurityDeposits() {
  const { data, error } = await supabaseDB
    .from('orders')
    .select(`
      id,
      security_deposit,
      payment_status,
      products (
        title
      ),
      buyer:profiles!orders_buyer_id_fkey (
        email
      )
    `)
    .gt('security_deposit', 0);
    
  if (error) {
    throw new Error(`Failed to fetch security deposits: ${error.message}`);
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
