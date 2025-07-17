import supabaseDB from "../../config/connectDB";

export interface CreateRentalData {
  buyerId: string;
  productId: string;
  sellerId: string;
  rental_start_date: string;
  rental_end_date: string;
  rentalDurationDays: number;
  totalRentalPrice: number;
  securityDeposit: number;
  tryOnFee?: number;
  totalAmount: number;
  pickupAddress?: any;
  deliveryAddress?: any;
  deliveryPartnerId?: string;
}

export interface UpdateRentalData {
  deliveryStatus?: string;
  paymentStatus?: string;
  orderStatus?: string;
  actualReturnDate?: string;
  isLateReturn?: boolean;
  lateFee?: number;
  damageFee?: number;
  collectionPhotoUrl?: string;
  damageClaimStatus?: string;
  damageClaimDescription?: string;
  damageClaimPhotos?: string[];
  securityDepositStatus?: string;
  securityDepositRefundAmount?: number;
  adminNotes?: string;
  lastAdminAction?: string;
  lastAdminActionBy?: string;
}

export async function createRental(rentalData: CreateRentalData) {
    console.log('Creating rental with data:', rentalData);

    const { data: sellerId, error: sellerError } = await supabaseDB
        .from('products')
        .select('seller_id')
        .eq('id', rentalData.productId)
        .maybeSingle();
  const { data, error } = await supabaseDB
    .from('orders')
    .insert([{
      buyer_id: rentalData.buyerId,
      product_id: rentalData.productId,
      seller_id: rentalData.sellerId || sellerId?.seller_id, // Use provided sellerId or fetch from product
      rental_start_date: rentalData.rental_start_date,
      rental_end_date: rentalData.rental_end_date,
      rental_duration_days: rentalData.rentalDurationDays,
      total_rental_price: rentalData.totalRentalPrice,
      security_deposit: rentalData.securityDeposit,
      try_on_fee: rentalData.tryOnFee || 0,
      total_amount: rentalData.totalAmount,
      pickup_address: rentalData.pickupAddress,
      delivery_address: rentalData.deliveryAddress,
      delivery_partner_id: rentalData.deliveryPartnerId,
      expected_return_date: rentalData.rental_end_date,
      delivery_status: 'pending',
      payment_status: 'pending',
      order_status: 'upcoming'
    }])
    .select()
    .single();

    console.log('Rental creation response:', data, 'Error:', sellerError || error);

  if (error) {
    throw new Error(`Failed to create rental: ${error.message}`);
  }

  return data;
}

export async function getRentalById(rentalId: string) {
  const { data, error } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (*),
      buyer:profiles!orders_buyer_id_fkey (id, full_name, email),
      seller:profiles!orders_seller_id_fkey (id, full_name, email),
      delivery_partner:profiles!orders_delivery_partner_id_fkey (id, full_name, email),
      damage_reviewer:profiles!orders_damage_reviewed_by_fkey (id, full_name),
      admin_actor:profiles!orders_last_admin_action_by_fkey (id, full_name)
    `)
    .eq('id', rentalId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch rental: ${error.message}`);
  }

  return data;
}

export async function getUserRentals(userId: string, userType: 'buyer' | 'seller', page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;
  const userField = userType === 'buyer' ? 'buyer_id' : 'seller_id';
  
  const { data, error, count } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (*),
      buyer:profiles!orders_buyer_id_fkey (id, full_name, email),
      seller:profiles!orders_seller_id_fkey (id, full_name, email),
      delivery_partner:profiles!orders_delivery_partner_id_fkey (id, full_name, email)
    `, { count: 'exact' })
    .eq(userField, userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch ${userType} rentals: ${error.message}`);
  }

  return {
    rentals: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function updateRental(rentalId: string, updateData: UpdateRentalData, adminId?: string) {
  const updates: any = { ...updateData };
  
  if (adminId) {
    updates.last_admin_action_by = adminId;
    updates.last_admin_action_at = new Date().toISOString();
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update(updates)
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update rental: ${error.message}`);
  }

  return data;
}

export async function updateDeliveryStatus(rentalId: string, status: string, deliveryPartnerId?: string) {
  const updates: any = { delivery_status: status };
  
  if (deliveryPartnerId) {
    updates.delivery_partner_id = deliveryPartnerId;
    updates.delivery_assigned_at = new Date().toISOString();
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update(updates)
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update delivery status: ${error.message}`);
  }

  return data;
}

export async function updatePaymentStatus(rentalId: string, status: string) {
  const { data, error } = await supabaseDB
    .from('orders')
    .update({ payment_status: status })
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update payment status: ${error.message}`);
  }

  return data;
}

export async function processReturn(rentalId: string, returnDate: string, collectionPhotoUrl?: string) {
  const rental = await getRentalById(rentalId);
  const expectedReturnDate = new Date(rental.expected_return_date);
  const actualReturnDate = new Date(returnDate);
  const isLate = actualReturnDate > expectedReturnDate;
  
  let lateFee = 0;
  if (isLate) {
    const daysLate = Math.ceil((actualReturnDate.getTime() - expectedReturnDate.getTime()) / (1000 * 60 * 60 * 24));
    lateFee = daysLate * (rental.total_rental_price / rental.rental_duration_days) * 0.1; // 10% daily late fee
  }

  const updates: any = {
    actual_return_date: returnDate,
    is_late_return: isLate,
    late_fee: lateFee,
    order_status: isLate ? 'late' : 'completed',
    delivery_status: 'returned',
    collection_photo_url: collectionPhotoUrl
  };

  if (isLate) {
    updates.late_fee_applied_at = new Date().toISOString();
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update(updates)
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to process return: ${error.message}`);
  }

  return data;
}

export async function reportDamage(rentalId: string, description: string, photos: string[], reviewerId?: string) {
  const updates: { [key: string]: any } = {
    damage_claim_status: 'reported',
    damage_claim_description: description,
    damage_claim_photos: photos
  };

  if (reviewerId) {
    updates.damage_reviewed_by = reviewerId;
    updates.damage_reviewed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseDB
    .from('orders')
    .update(updates)
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to report damage: ${error.message}`);
  }

  return data;
}

export async function reviewDamage(rentalId: string, status: 'approved' | 'rejected', damageFee: number, reviewerId: string) {
  const updates = {
    damage_claim_status: status,
    damage_fee: status === 'approved' ? damageFee : 0,
    damage_reviewed_by: reviewerId,
    damage_reviewed_at: new Date().toISOString()
  };

  const { data, error } = await supabaseDB
    .from('orders')
    .update(updates)
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to review damage: ${error.message}`);
  }

  return data;
}

export async function releaseSecurityDeposit(rentalId: string, refundAmount: number, status: string) {
  const { data, error } = await supabaseDB
    .from('orders')
    .update({
      security_deposit_status: status,
      security_deposit_refund_amount: refundAmount,
      security_deposit_released_at: new Date().toISOString()
    })
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to release security deposit: ${error.message}`);
  }

  return data;
}

export async function getActiveRentals(page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;
  
  const { data, error, count } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (*),
      buyer:profiles!orders_buyer_id_fkey (id, full_name, email),
      seller:profiles!orders_seller_id_fkey (id, full_name, email),
      delivery_partner:profiles!orders_delivery_partner_id_fkey (id, full_name, email)
    `, { count: 'exact' })
    .in('order_status', ['upcoming', 'ongoing'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch active rentals: ${error.message}`);
  }

  return {
    rentals: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function getOverdueRentals(page: number = 1, limit: number = 10) {
  const today = new Date().toISOString().split('T')[0];
  const offset = (page - 1) * limit;
  
  const { data, error, count } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (*),
      buyer:profiles!orders_buyer_id_fkey (id, full_name, email),
      seller:profiles!orders_seller_id_fkey (id, full_name, email)
    `, { count: 'exact' })
    .lt('expected_return_date', today)
    .eq('order_status', 'ongoing')
    .is('actual_return_date', null)
    .order('expected_return_date', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch overdue rentals: ${error.message}`);
  }

  return {
    rentals: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function cancelRental(rentalId: string, reason: string, adminId?: string) {
  const updates = {
    order_status: 'cancelled',
    delivery_status: 'cancelled',
    admin_notes: reason,
    last_admin_action: 'cancelled',
    last_admin_action_by: adminId,
    last_admin_action_at: new Date().toISOString()
  };

  const { data, error } = await supabaseDB
    .from('orders')
    .update(updates)
    .eq('id', rentalId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel rental: ${error.message}`);
  }

  return data;
}