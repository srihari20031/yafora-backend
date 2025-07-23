import supabaseDB from "../../config/connectDB";

export async function getSellerOrders(sellerId: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (*),
      buyer:profiles!orders_buyer_id_fkey (id, full_name, email, phone_number)
    `, { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch seller orders: ${error.message}`);
  }

  return {
    rentals: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function updateSellerOrderDeliveryStatus(orderId: string, status: string, sellerId: string) {
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select('seller_id')
    .eq('id', orderId)
    .single();

  if (orderError || order.seller_id !== sellerId) {
    throw new Error(`Unauthorized or failed to fetch order: ${orderError?.message || 'Order not found'}`);
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update({ 
      delivery_status: status,
      last_admin_action: 'delivery_status_updated',
      last_admin_action_by: sellerId,
      last_admin_action_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update delivery status: ${error.message}`);
  }

  return data;
}

export async function refundSecurityDeposit(orderId: string, sellerId: string) {
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select('seller_id, order_status, payment_status, security_deposit, security_deposit_status')
    .eq('id', orderId)
    .single();

  if (orderError || order.seller_id !== sellerId) {
    throw new Error(`Unauthorized or failed to fetch order: ${orderError?.message || 'Order not found'}`);
  }

  if (order.order_status !== 'returned') {
    throw new Error('Security deposit can only be refunded for returned orders');
  }

  if (order.payment_status !== 'completed') {
    throw new Error('Security deposit can only be refunded for completed payments');
  }

  if (order.security_deposit_status !== 'held') {
    throw new Error('Security deposit has already been processed');
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update({
      security_deposit_status: 'released',
      security_deposit_refunded_amount: order.security_deposit,
      security_deposit_released_at: new Date().toISOString(),
      last_admin_action: 'security_deposit_refunded',
      last_admin_action_by: sellerId,
      last_admin_action_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to refund security deposit: ${error.message}`);
  }

  // Create payment record for refund
  const { error: paymentError } = await supabaseDB
    .from('payments')
    .insert({
      order_id: orderId,
      user_id: sellerId,
      amount: order.security_deposit,
      payment_type: 'security_deposit_refunded',
      payment_status: 'completed',
      created_at: new Date().toISOString()
    });

  if (paymentError) {
    throw new Error(`Failed to create refund payment record: ${paymentError.message}`);
  }

  return data;
}

export async function reportSellerOrderDamage(orderId: string, description: string, photos: string[], sellerId: string) {
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select('seller_id, order_status, delivery_status')
    .eq('id', orderId)
    .single();

  if (orderError || order.seller_id !== sellerId) {
    throw new Error(`Unauthorized or failed to fetch order: ${orderError?.message || 'Order not found'}`);
  }

  if (!['returned', 'returned_damaged'].includes(order.order_status)) {
    throw new Error('Damage can only be reported for returned orders');
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update({
      damage_claim_status: 'reported',
      damage_claim_description: description,
      damage_claim_photos: photos,
      damage_reviewed_by: sellerId,
      damage_reviewed_at: new Date().toISOString(),
      last_admin_action: 'damage_reported',
      last_admin_action_by: sellerId,
      last_admin_action_at: new Date().toISOString(),
      delivery_status: order.delivery_status === 'returned' ? 'returned_damaged' : order.delivery_status
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to report damage: ${error.message}`);
  }

  return data;
}

export async function cancelSellerOrder(orderId: string, reason: string, sellerId: string) {
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select('seller_id, order_status')
    .eq('id', orderId)
    .single();

  if (orderError || order.seller_id !== sellerId) {
    throw new Error(`Unauthorized or failed to fetch order: ${orderError?.message || 'Order not found'}`);
  }

  if (['completed', 'cancelled'].includes(order.order_status)) {
    throw new Error('Cannot cancel completed or already cancelled orders');
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update({
      order_status: 'cancelled',
      delivery_status: 'cancelled',
      admin_notes: reason,
      last_admin_action: 'cancelled',
      last_admin_action_by: sellerId,
      last_admin_action_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel order: ${error.message}`);
  }

  return data;
}

export async function getSellerTotalTransactions(sellerId: string) {
  const { data, error } = await supabaseDB
    .from('orders')
    .select('total_amount, security_deposit, damage_fee, commission_amount')
    .eq('seller_id', sellerId)
    .eq('order_status', 'completed');

  if (error) {
    throw new Error(`Failed to fetch seller transactions: ${error.message}`);
  }

  const totals = data.reduce((acc, order) => ({
    totalRevenue: acc.totalRevenue + order.total_amount,
    totalSecurityDeposits: acc.totalSecurityDeposits + order.security_deposit,
    totalDamageFees: acc.totalDamageFees + order.damage_fee,
    totalCommission: acc.totalCommission + order.commission_amount
  }), {
    totalRevenue: 0,
    totalSecurityDeposits: 0,
    totalDamageFees: 0,
    totalCommission: 0
  });

  return totals;
}