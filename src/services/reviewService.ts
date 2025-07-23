import supabaseDB from "../../config/connectDB";

// Create a new review
export async function createReview(
  productId: string,
  buyerId: string,
  orderId: string,
  rating: number,
  comment?: string
) {
  // Check if buyer has already reviewed this product for this order
  const { data: existingReview, error: checkError } = await supabaseDB
    .from('reviews')
    .select('id')
    .eq('product_id', productId)
    .eq('buyer_id', buyerId)
    .eq('order_id', orderId)
    .single();

  if (existingReview) {
    throw new Error('Review already exists for this order and product');
  }

  // Verify that the order belongs to the buyer and includes this product
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select('buyer_id, product_id, order_status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  if (order.buyer_id !== buyerId) {
    throw new Error('Unauthorized: Order does not belong to this buyer');
  }

  if (order.product_id !== productId) {
    throw new Error('Product does not match the order');
  }

  if (order.order_status !== 'completed') {
    throw new Error('Can only review completed orders');
  }

  const { data, error } = await supabaseDB
    .from('reviews')
    .insert({
      product_id: productId,
      buyer_id: buyerId,
      order_id: orderId,
      rating,
      comment
    })
    .select(`
      *,
      product:products(*),
      buyer:profiles!reviews_buyer_id_fkey(id, full_name, profile_picture_url)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create review: ${error.message}`);
  }

  return data;
}

// Update an existing review
export async function updateReview(
  reviewId: string,
  buyerId: string,
  rating?: number,
  comment?: string
) {
  const { data: existingReview, error: checkError } = await supabaseDB
    .from('reviews')
    .select('buyer_id')
    .eq('id', reviewId)
    .single();

  if (checkError || !existingReview) {
    throw new Error('Review not found');
  }

  if (existingReview.buyer_id !== buyerId) {
    throw new Error('Unauthorized: You can only update your own reviews');
  }

  const updateData: any = {};
  if (rating !== undefined) updateData.rating = rating;
  if (comment !== undefined) updateData.comment = comment;

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  const { data, error } = await supabaseDB
    .from('reviews')
    .update(updateData)
    .eq('id', reviewId)
    .select(`
      *,
      product:products(*),
      buyer:profiles!reviews_buyer_id_fkey(id, full_name, profile_picture_url)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update review: ${error.message}`);
  }

  return data;
}

// Delete a review
export async function deleteReview(reviewId: string, buyerId: string) {
  const { data: existingReview, error: checkError } = await supabaseDB
    .from('reviews')
    .select('buyer_id')
    .eq('id', reviewId)
    .single();

  if (checkError || !existingReview) {
    throw new Error('Review not found');
  }

  if (existingReview.buyer_id !== buyerId) {
    throw new Error('Unauthorized: You can only delete your own reviews');
  }

  const { error } = await supabaseDB
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) {
    throw new Error(`Failed to delete review: ${error.message}`);
  }

  return { message: 'Review deleted successfully' };
}

// Get reviews for a specific product
export async function getProductReviews(
  productId: string,
  page: number = 1,
  limit: number = 10
) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseDB
    .from('reviews')
    .select(`
      *,
      buyer:profiles!reviews_buyer_id_fkey(id, full_name, profile_picture_url)
    `, { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch product reviews: ${error.message}`);
  }

  // Calculate average rating
  const { data: ratingData, error: ratingError } = await supabaseDB
    .from('reviews')
    .select('rating')
    .eq('product_id', productId);

  let averageRating = 0;
  let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (ratingData && ratingData.length > 0) {
    const totalRating = ratingData.reduce((sum, review) => sum + review.rating, 0);
    averageRating = totalRating / ratingData.length;
    
    ratingData.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });
  }

  return {
    reviews: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: count || 0,
    ratingDistribution
  };
}

// Get reviews for products by a specific seller
export async function getSellerReviews(
  sellerId: string,
  page: number = 1,
  limit: number = 10
) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseDB
    .from('reviews')
    .select(`
      *,
      product:products!reviews_product_id_fkey(*),
      buyer:profiles!reviews_buyer_id_fkey(id, full_name, profile_picture_url)
    `, { count: 'exact' })
    .eq('products.seller_id', sellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch seller reviews: ${error.message}`);
  }

  // Calculate seller's average rating
  const { data: ratingData, error: ratingError } = await supabaseDB
    .from('reviews')
    .select('rating')
    .eq('products.seller_id', sellerId);

  let averageRating = 0;
  let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (ratingData && ratingData.length > 0) {
    const totalRating = ratingData.reduce((sum, review) => sum + review.rating, 0);
    averageRating = totalRating / ratingData.length;
    
    ratingData.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });
  }

  return {
    reviews: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: count || 0,
    ratingDistribution
  };
}

// Get reviews by a specific buyer
export async function getBuyerReviews(
  buyerId: string,
  page: number = 1,
  limit: number = 10
) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseDB
    .from('reviews')
    .select(`
      *,
      product:products!reviews_product_id_fkey(*),
      order:orders!reviews_order_id_fkey(id, created_at, order_status)
    `, { count: 'exact' })
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch buyer reviews: ${error.message}`);
  }

  return {
    reviews: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

// Get seller statistics (for seller dashboard)
export async function getSellerReviewStats(sellerId: string) {
  const { data: ratingData, error: ratingError } = await supabaseDB
    .from('reviews')
    .select('rating, created_at')
    .eq('products.seller_id', sellerId);

  if (ratingError) {
    throw new Error(`Failed to fetch seller review stats: ${ratingError.message}`);
  }

  if (!ratingData || ratingData.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recentReviewsCount: 0
    };
  }

  const totalRating = ratingData.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / ratingData.length;
  
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingData.forEach(review => {
    ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
  });

  // Count recent reviews (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentReviewsCount = ratingData.filter(
    review => new Date(review.created_at) >= thirtyDaysAgo
  ).length;

  return {
    totalReviews: ratingData.length,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution,
    recentReviewsCount
  };
}

// Check if buyer can review a product (has completed order)
export async function canBuyerReviewProduct(
  buyerId: string,
  productId: string,
  orderId: string
) {
  // Check if order exists and is completed
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select('buyer_id, product_id, order_status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { canReview: false, reason: 'Order not found' };
  }

  if (order.buyer_id !== buyerId) {
    return { canReview: false, reason: 'Order does not belong to this buyer' };
  }

  if (order.product_id !== productId) {
    return { canReview: false, reason: 'Product does not match the order' };
  }

  if (order.order_status !== 'completed') {
    return { canReview: false, reason: 'Order must be completed to leave a review' };
  }

  // Check if review already exists
  const { data: existingReview } = await supabaseDB
    .from('reviews')
    .select('id')
    .eq('product_id', productId)
    .eq('buyer_id', buyerId)
    .eq('order_id', orderId)
    .single();

  if (existingReview) {
    return { canReview: false, reason: 'Review already exists for this order' };
  }

  return { canReview: true, reason: null };
}