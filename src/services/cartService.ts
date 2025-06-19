import supabaseDB from "../../config/connectDB";

interface CartItemUpdate {
  rentalStartDate?: string;
  rentalEndDate?: string;
  tryOnRequested?: boolean;
}

export async function addToCart(
  buyerId: string, 
  productId: string, 
  rentalStartDate: string, 
  rentalEndDate: string,
  tryOnRequested: boolean = false
) {
  // Validate dates
  const startDate = new Date(rentalStartDate);
  const endDate = new Date(rentalEndDate);
  
  if (startDate >= endDate) {
    throw new Error('Rental end date must be after start date');
  }
  
  if (startDate < new Date()) {
    throw new Error('Rental start date cannot be in the past');
  }
  
  // Calculate rental duration
  const rentalDurationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Check if product exists and is available
  const { data: product, error: productError } = await supabaseDB
    .from('products')
    .select('id, availability_status, title')
    .eq('id', productId)
    .single();
    
  if (productError || !product) {
    throw new Error('Product not found');
  }
  
  if (product.availability_status !== 'available') {
    throw new Error('Product is not available for rental');
  }
  
  // Check if already in cart
  const { data: existing } = await supabaseDB
    .from('cart')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('product_id', productId)
    .single();
    
  if (existing) {
    throw new Error('Product already in cart');
  }
  
  // Add to cart
  const { data, error } = await supabaseDB
    .from('cart')
    .insert([{
      buyer_id: buyerId,
      product_id: productId,
      rental_start_date: rentalStartDate,
      rental_end_date: rentalEndDate,
      rental_duration_days: rentalDurationDays,
      try_on_requested: tryOnRequested,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    }])
    .select(`
      *,
      products (
        id,
        title,
        rental_price_per_day,
        security_deposit_percentage,
        images
      )
    `)
    .single();
    
  if (error) {
    throw new Error(`Failed to add to cart: ${error.message}`);
  }
  
  return data;
}

export async function removeFromCart(buyerId: string, productId: string) {
  const { error } = await supabaseDB
    .from('cart')
    .delete()
    .eq('buyer_id', buyerId)
    .eq('product_id', productId);
    
  if (error) {
    throw new Error(`Failed to remove from cart: ${error.message}`);
  }
}

export async function getUserCart(buyerId: string) {
  const { data, error } = await supabaseDB
    .from('cart')
    .select(`
      *,
      products (
        id,
        title,
        category,
        images,
        rental_price_per_day,
        security_deposit_percentage,
        size,
        availability_status,
        profiles!products_seller_id_fkey (
          full_name,
          pickup_address
        )
      )
    `)
    .eq('buyer_id', buyerId)
    .gt('expires_at', new Date().toISOString()) // Only non-expired items
    .order('created_at', { ascending: false });
    
  if (error) {
    throw new Error(`Failed to fetch cart: ${error.message}`);
  }
  
  // Calculate totals for each item and overall cart
  const cartItems = data?.map(item => {
    const product = item.products;
    const totalRentalPrice = product.rental_price_per_day * item.rental_duration_days;
    const securityDeposit = (totalRentalPrice * product.security_deposit_percentage) / 100;
    const tryOnFee = item.try_on_requested ? 50 : 0; // Assuming ₹50 try-on fee
    const totalItemPrice = totalRentalPrice + securityDeposit + tryOnFee;
    
    return {
      ...item,
      calculated_totals: {
        total_rental_price: totalRentalPrice,
        security_deposit: securityDeposit,
        try_on_fee: tryOnFee,
        total_item_price: totalItemPrice
      }
    };
  }) || [];
  
  // Calculate cart summary
  const cartSummary = cartItems.reduce((summary, item) => {
    const totals = item.calculated_totals;
    return {
      total_rental_price: summary.total_rental_price + totals.total_rental_price,
      total_security_deposit: summary.total_security_deposit + totals.security_deposit,
      total_try_on_fee: summary.total_try_on_fee + totals.try_on_fee,
      grand_total: summary.grand_total + totals.total_item_price,
      item_count: summary.item_count + 1
    };
  }, {
    total_rental_price: 0,
    total_security_deposit: 0,
    total_try_on_fee: 0,
    grand_total: 0,
    item_count: 0
  });
  
  return {
    items: cartItems,
    summary: cartSummary
  };
}

export async function updateCartItem(
  buyerId: string, 
  productId: string, 
  updates: CartItemUpdate
) {
  const updateData: any = {};
  
  // Validate and prepare updates
  if (updates.rentalStartDate && updates.rentalEndDate) {
    const startDate = new Date(updates.rentalStartDate);
    const endDate = new Date(updates.rentalEndDate);
    
    if (startDate >= endDate) {
      throw new Error('Rental end date must be after start date');
    }
    
    if (startDate < new Date()) {
      throw new Error('Rental start date cannot be in the past');
    }
    
    const rentalDurationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    updateData.rental_start_date = updates.rentalStartDate;
    updateData.rental_end_date = updates.rentalEndDate;
    updateData.rental_duration_days = rentalDurationDays;
  }
  
  if (updates.tryOnRequested !== undefined) {
    updateData.try_on_requested = updates.tryOnRequested;
  }
  
  updateData.updated_at = new Date().toISOString();
  
  const { data, error } = await supabaseDB
    .from('cart')
    .update(updateData)
    .eq('buyer_id', buyerId)
    .eq('product_id', productId)
    .select(`
      *,
      products (
        id,
        title,
        rental_price_per_day,
        security_deposit_percentage,
        images
      )
    `)
    .single();
    
  if (error) {
    throw new Error(`Failed to update cart item: ${error.message}`);
  }
  
  return data;
}

export async function clearUserCart(buyerId: string) {
  const { error } = await supabaseDB
    .from('cart')
    .delete()
    .eq('buyer_id', buyerId);
    
  if (error) {
    throw new Error(`Failed to clear cart: ${error.message}`);
  }
}

export async function checkIfInCart(buyerId: string, productId: string): Promise<boolean> {
  const { data, error } = await supabaseDB
    .from('cart')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('product_id', productId)
    .gt('expires_at', new Date().toISOString()) // Only check non-expired items
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    throw new Error(`Failed to check cart status: ${error.message}`);
  }
  
  return !!data;
}