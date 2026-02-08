import supabaseDB from "../../config/connectDB";
import { confirmOrder, rejectOrder } from './orderService';
import { NotificationTriggers } from '../../utils/notificationTriggers';

export async function getSellerOrders(sellerId: string, page: number = 1, limit: number = 10, status?: string) {
  const offset = (page - 1) * limit;

  let query = supabaseDB
    .from('orders')
    .select(`
      *,
      products (*),
      buyer:profiles!orders_buyer_id_fkey (id, full_name, email, phone_number)
    `, { count: 'exact' })
    .eq('seller_id', sellerId);

  if (status && status !== 'all') {
    query = query.eq('order_status', status);
  }

  const { data, error, count } = await query
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

export async function getSellerReviews(sellerId: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  // First, get all products by this seller
  const { data: sellerProducts, error: productsError } = await supabaseDB
    .from('products')
    .select('id')
    .eq('seller_id', sellerId);

  if (productsError) {
    throw new Error(`Failed to fetch seller products: ${productsError.message}`);
  }

  if (!sellerProducts || sellerProducts.length === 0) {
    return {
      products: [],
      total_reviews: 0,
      overall_average_rating: 0,
      page,
      limit,
      totalPages: 0
    };
  }

  const productIds = sellerProducts.map(p => p.id);

  // Get all reviews for these products with product and buyer details
  const { data: allReviews, error: reviewsError } = await supabaseDB
    .from('reviews')
    .select(`
      id,
      rating,
      comment,
      created_at,
      product_id,
      buyer:profiles!reviews_buyer_id_fkey (
        id,
        full_name
      ),
      product:products!reviews_product_id_fkey (
        id,
        title,
        images
      )
    `)
    .in('product_id', productIds)
    .order('created_at', { ascending: false });

  if (reviewsError) {
    throw new Error(`Failed to fetch reviews: ${reviewsError.message}`);
  }

  // Group reviews by product
  const productReviewsMap = new Map();
  
  allReviews?.forEach((review: any) => {
    const productId = review.product_id;
    
    if (!productReviewsMap.has(productId)) {
      productReviewsMap.set(productId, {
        product_id: review.product.id,
        product_title: review.product.title,
        product_images: review.product.images,
        total_reviews: 0,
        average_rating: 0,
        rating_sum: 0,
        reviews: []
      });
    }
    
    const productData = productReviewsMap.get(productId);
    productData.total_reviews += 1;
    productData.rating_sum += review.rating;
    productData.reviews.push({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      buyer: {
        id: review.buyer.id,
        full_name: review.buyer.full_name
      }
    });
  });

  // Calculate average ratings and limit reviews to 10 per product
  const productsWithReviews = Array.from(productReviewsMap.values()).map(product => {
    product.average_rating = product.rating_sum / product.total_reviews;
    delete product.rating_sum;
    
    // Keep only the 10 most recent reviews for each product
    product.reviews = product.reviews.slice(0, 10);
    
    return product;
  });

  // Sort products by total reviews (most reviewed first)
  productsWithReviews.sort((a, b) => b.total_reviews - a.total_reviews);

  // Calculate overall statistics
  const totalReviews = allReviews?.length || 0;
  const overallAverageRating = totalReviews > 0
    ? allReviews.reduce((sum: number, review: any) => sum + review.rating, 0) / totalReviews
    : 0;

  // Paginate products
  const totalPages = Math.ceil(productsWithReviews.length / limit);
  const paginatedProducts = productsWithReviews.slice(offset, offset + limit);

  return {
    products: paginatedProducts,
    total_reviews: totalReviews,
    overall_average_rating: overallAverageRating,
    page,
    limit,
    totalPages
  };
}

export const acceptSellerOrder = async (orderId: string, sellerId: string) => {
  // Verify seller owns this order
  const { data: order, error: fetchError } = await supabaseDB
    .from('orders')
    .select('*, products(title), profiles!buyer_id(full_name, email)')
    .eq('id', orderId)
    .eq('seller_id', sellerId)
    .single();

  if (fetchError || !order) {
    throw new Error('Order not found or you do not have permission');
  }

  if (order.seller_confirmation_status !== 'pending') {
    throw new Error('Order has already been confirmed or rejected');
  }

  // Confirm the order
  const confirmedOrder = await confirmOrder(orderId);

  // Send notification to buyer
  await NotificationTriggers.triggerOrderConfirmed(confirmedOrder);

  return confirmedOrder;
};

export const rejectSellerOrder = async (
  orderId: string,
  sellerId: string,
  reason: string
) => {
  // Verify seller owns this order
  const { data: order, error: fetchError } = await supabaseDB
    .from('orders')
    .select('*, products(title), profiles!buyer_id(full_name, email)')
    .eq('id', orderId)
    .eq('seller_id', sellerId)
    .single();

  if (fetchError || !order) {
    throw new Error('Order not found or you do not have permission');
  }

  if (order.seller_confirmation_status !== 'pending') {
    throw new Error('Order has already been confirmed or rejected');
  }

  // Reject the order
  const rejectedOrder = await rejectOrder(orderId, reason);

  // Send notification to buyer
  await NotificationTriggers.triggerOrderRejected(rejectedOrder, reason);

  // TODO: Trigger refund process here
  // await processRefund(order.id, order.total_amount);

  return rejectedOrder;
};

// Types for seller stats
interface SellerStats {
  overview: {
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    averageRating: number;
    totalReviews: number;
    pendingEarnings: number;
    securityDepositsHeld: number;
  };
  recentOrders: any[];
  topProducts: any[];
}

// Get seller stats
export async function getSellerStats(sellerId: string): Promise<SellerStats> {
  try {
    // Get products count
    const { count: totalProducts } = await supabaseDB
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId);

    const { count: activeProducts } = await supabaseDB
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('availability_status', 'available');

    // Get orders
    const { data: orders } = await supabaseDB
      .from('orders')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    const allOrders = orders || [];
    const pendingOrders = allOrders.filter(o => o.seller_confirmation_status === 'pending').length;
    const completedOrders = allOrders.filter(o => ['completed', 'delivered'].includes(o.order_status)).length;
    const cancelledOrders = allOrders.filter(o => o.order_status === 'cancelled').length;
    const totalRevenue = allOrders
      .filter(o => ['completed', 'delivered'].includes(o.order_status))
      .reduce((sum, o) => sum + (o.total_rental_price || 0), 0);
    const pendingEarnings = allOrders
      .filter(o => o.order_status === 'confirmed')
      .reduce((sum, o) => sum + (o.total_rental_price || 0), 0);
    const securityDepositsHeld = allOrders
      .filter(o => o.security_deposit_status === 'held')
      .reduce((sum, o) => sum + (o.security_deposit || 0), 0);

    // Get seller products for reviews
    const { data: sellerProducts } = await supabaseDB
      .from('products')
      .select('id')
      .eq('seller_id', sellerId);

    const productIds = sellerProducts?.map(p => p.id) || [];

    // Get reviews
    const { data: reviews } = await supabaseDB
      .from('reviews')
      .select('rating')
      .in('product_id', productIds);

    const totalReviews = reviews?.length || 0;
    const averageRating = totalReviews > 0 && reviews
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews
      : 0;

    // Get recent orders
    const recentOrders = allOrders.slice(0, 5);

    // Get top products
    const { data: topProducts } = await supabaseDB
      .from('orders')
      .select(`
        product_id,
        products (title, cover_image_url),
        total_rental_price
      `)
      .eq('seller_id', sellerId)
      .in('order_status', ['completed', 'delivered'])
      .limit(5);

    // Aggregate top products
    const productStats = new Map();
    topProducts?.forEach(order => {
      const productId = order.product_id;
      if (!productStats.has(productId)) {
        productStats.set(productId, {
          id: productId,
          title: order.products?.[0]?.title || 'Unknown',
          image: order.products?.[0]?.cover_image_url,
          totalOrders: 0,
          totalRevenue: 0
        });
      }
      const stats = productStats.get(productId);
      stats.totalOrders += 1;
      stats.totalRevenue += order.total_rental_price || 0;
    });

    const sortedTopProducts = Array.from(productStats.values())
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 5);

    return {
      overview: {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        totalOrders: allOrders.length,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        averageRating: parseFloat(averageRating.toFixed(1)),
        totalReviews,
        pendingEarnings,
        securityDepositsHeld
      },
      recentOrders,
      topProducts: sortedTopProducts
    };
  } catch (error) {
    console.error('Error in getSellerStats:', error);
    throw new Error(`Failed to fetch seller stats: ${error}`);
  }
}

export const getSellerPendingOrders = async (sellerId: string) => {
  const { data, error } = await supabaseDB
    .from('orders')
    .select('*, products(*), profiles!buyer_id(*)')
    .eq('seller_id', sellerId)
    .eq('seller_confirmation_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const getSellerOrderById = async (orderId: string, sellerId: string) => {

  console.log("Order id in service:", orderId);
  console.log("Seller id in service:", sellerId);
  const { data, error } = await supabaseDB
    .from('orders')
    .select(`
      *,
      products (
        id,
        title,
        images,
        cover_image_url,
        rental_price_per_day
      ),
      buyer:profiles!orders_buyer_id_fkey (
        id,
        full_name,
        email,
        phone_number
      )
    `)
    .eq('id', orderId)
    .eq('seller_id', sellerId)
    .single();

    console.log("Data fetched in service:", data);
    console.log("Error in service:", error);

  if (error || !data) {
    throw new Error("Order not found or you do not have permission to view it");
  }

  return data;
};
