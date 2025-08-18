import supabaseDB from "../../config/connectDB"; // Adjust import path as needed

// Types for better type safety
interface DashboardOverview {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  platformCommission: number;
  conversionRate: number;
  averageOrderValue: number;
  userGrowth: number;
  orderGrowth: number;
  revenueGrowth: number;
}

interface TrendData {
  date: string;
  newUsers?: number;
  totalOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  totalRevenue?: number;
  grossRevenue?: number;
  commission?: number;
  damageFees?: number;
  netRevenue?: number;
}

interface UserAnalytics {
  trends: TrendData[];
  summary: {
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
    retentionRate: number;
  };
}

interface OrderAnalytics {
  trends: TrendData[];
  summary: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    averageOrderValue: number;
  };
}

interface ProductAnalytics {
  topProducts: Array<{
    id: string;
    title: string;
    category: string;
    totalOrders: number;
    totalRevenue: number;
    averageRating?: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    revenue: number;
  }>;
}

interface RevenueAnalytics {
  trends: TrendData[];
  summary: {
    totalRevenue: number;
    totalCommission: number;
    totalDamageFees: number;
    netRevenue: number;
  };
}

interface ActiveUsersBreakdown {
  count: number;
  percentage: number;
  breakdown: {
    buyers: number;
    sellers: number;
    both: number;
  };
}

// Helper function to convert timeframe to days
function timeframeToDays(timeframe: string): number {
  switch (timeframe) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case '1y': return 365;
    default: return 30;
  }
}

// Helper function to calculate growth rate
function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Helper function to format date for SQL
function formatDateForSupabase(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

// Main dashboard overview with key metrics
export async function getDashboardOverview(timeframe: string): Promise<DashboardOverview> {
  const days = timeframeToDays(timeframe);
  const startDate = formatDateForSupabase(days);
  const previousStartDate = formatDateForSupabase(days * 2);
  const previousEndDate = formatDateForSupabase(days);

  try {
    // Get total users count
    const { count: totalUsers } = await supabaseDB
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get new users in current period
    const { count: newUsers } = await supabaseDB
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate);

    // Get new users in previous period for growth calculation
    const { count: previousNewUsers } = await supabaseDB
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousStartDate)
      .lt('created_at', previousEndDate);

    // Get total products
    const { count: totalProducts } = await supabaseDB
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('availability_status', 'available'); // Adjusted to match products table

    // Get current period orders
    const { data: currentOrders } = await supabaseDB
      .from('orders')
      .select('total_rental_price, total_amount, security_deposit, try_on_fee, order_status')
      .gte('created_at', startDate);

    // Get previous period orders for growth calculation
    const { data: previousOrders } = await supabaseDB
      .from('orders')
      .select('total_rental_price, total_amount, security_deposit, try_on_fee, order_status')
      .gte('created_at', previousStartDate)
      .lt('created_at', previousEndDate);

    // Calculate current period metrics
    const currentOrdersCount = currentOrders?.length || 0;
    const completedCurrentOrders = currentOrders?.filter(o => 
      ['completed', 'delivered'].includes(o.order_status)) || [];
    const currentRevenue = completedCurrentOrders.reduce((sum, order) => sum + (order.total_rental_price || 0), 0);
    const currentCommission = completedCurrentOrders.reduce((sum, order) => sum + (order.security_deposit || 0), 0); // Assuming commission is part of security deposit
    const avgOrderValue = completedCurrentOrders.length > 0 ? currentRevenue / completedCurrentOrders.length : 0;

    // Calculate previous period metrics for growth
    const previousOrdersCount = previousOrders?.length || 0;
    const completedPreviousOrders = previousOrders?.filter(o => 
      ['completed', 'delivered'].includes(o.order_status)) || [];
    const previousRevenue = completedPreviousOrders.reduce((sum, order) => sum + (order.total_rental_price || 0), 0);

    // Calculate growth rates
    const userGrowth = calculateGrowthRate(newUsers || 0, previousNewUsers || 0);
    const orderGrowth = calculateGrowthRate(currentOrdersCount, previousOrdersCount);
    const revenueGrowth = calculateGrowthRate(currentRevenue, previousRevenue);

    // For active users, we'll use orders as proxy if no session tracking exists
    const activeUsers = currentOrdersCount; // You can implement proper session tracking later
    const conversionRate = activeUsers > 0 ? (currentOrdersCount / activeUsers) * 100 : 0;

    return {
      totalUsers: totalUsers || 0,
      newUsers: newUsers || 0,
      activeUsers: activeUsers,
      totalProducts: totalProducts || 0,
      totalOrders: currentOrdersCount,
      totalRevenue: currentRevenue,
      platformCommission: currentCommission,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      averageOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      userGrowth,
      orderGrowth,
      revenueGrowth
    };
  }
    catch (error) {
        console.error('Error in getDashboardOverview:', error);
        throw new Error(`Failed to fetch dashboard overview: ${error}`);
    }
}

// User analytics with trends
export async function getUserAnalytics(period: string, days: number): Promise<UserAnalytics> {
  const startDate = formatDateForSupabase(days);
  
  try {
    // Get daily/weekly user registration trends
    const { data: userTrends } = await supabaseDB
      .from('profiles')
      .select('created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });

    // Process trends based on period (daily/weekly)
    const trends = processUserTrendsData(userTrends || [], period, days);

    // Get summary stats
    const { count: totalUsers } = await supabaseDB
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: newUsers } = await supabaseDB
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate);

    // Calculate retention (users who made more than one order)
    const { data: retentionData } = await supabaseDB
      .rpc('calculate_user_retention', { days_back: days });

    return {
      trends,
      summary: {
        totalUsers: totalUsers || 0,
        newUsers: newUsers || 0,
        activeUsers: newUsers || 0, // Placeholder - implement proper active user tracking
        retentionRate: retentionData?.[0]?.retention_rate || 0
      }
    };
  } catch (error) {
    console.error('Error in getUserAnalytics:', error);
    throw new Error(`Failed to fetch user analytics: ${error}`);
  }
}

// Order analytics with trends
export async function getOrderAnalytics(period: string, days: number): Promise<OrderAnalytics> {
  const startDate = formatDateForSupabase(days);
  
  try {
    // Get order trends
    const { data: orders } = await supabaseDB
      .from('orders')
      .select('created_at, order_status, total_rental_price')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });

    // Process trends
    const trends = processOrderTrendsData(orders || [], period, days);

    // Calculate summary
    const totalOrders = orders?.length || 0;
    const completedOrders = orders?.filter(o => ['completed', 'delivered'].includes(o.order_status)).length || 0;
    const cancelledOrders = orders?.filter(o => o.order_status === 'cancelled').length || 0;
    const totalRevenue = orders?.filter(o => ['completed', 'delivered'].includes(o.order_status))
      .reduce((sum, order) => sum + (order.total_rental_price || 0), 0) || 0;
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    return {
      trends,
      summary: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2))
      }
    };
  } catch (error) {
    console.error('Error in getOrderAnalytics:', error);
    throw new Error(`Failed to fetch order analytics: ${error}`);
  }
}

// Revenue analytics with trends
export async function getRevenueAnalytics(period: string, days: number): Promise<RevenueAnalytics> {
  const startDate = formatDateForSupabase(days);
  
  try {
    const { data: orders } = await supabaseDB
      .from('orders')
      .select('created_at, order_status, total_rental_price, security_deposit, damage_fee')
      .gte('created_at', startDate)
      .in('order_status', ['completed', 'delivered'])
      .order('created_at', { ascending: true });

    // Process revenue trends
    const trends = processRevenueTrendsData(orders || [], period, days);

    // Calculate totals
    const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_rental_price || 0), 0) || 0;
    const totalCommission = orders?.reduce((sum, order) => sum + (order.security_deposit || 0), 0) || 0; // Assuming commission is part of security deposit
    const totalDamageFees = orders?.reduce((sum, order) => sum + (order.damage_fee || 0), 0) || 0;

    return {
      trends,
      summary: {
        totalRevenue,
        totalCommission,
        totalDamageFees,
        netRevenue: totalRevenue - totalCommission
      }
    };
  } catch (error) {
    console.error('Error in getRevenueAnalytics:', error);
    throw new Error(`Failed to fetch revenue analytics: ${error}`);
  }
}

// Product analytics
export async function getProductAnalytics(limit: number, timeframe: string, sortBy: string): Promise<ProductAnalytics> {
  const days = timeframeToDays(timeframe);
  const startDate = formatDateForSupabase(days);
  
  try {
    // Get top performing products
    const { data: topProducts } = await supabaseDB
      .from('orders')
      .select(`
        product_id,
        total_rental_price,
        products (
          id,
          title,
          category
        )
      `)
      .gte('created_at', startDate)
      .in('order_status', ['completed', 'delivered'])
      .limit(1000); // Get more data to process

    // Process and aggregate product data
    const productMap = new Map();
    topProducts?.forEach(order => {
      const productId = order.product_id;
      const product = order.products;
      
      if (productMap.has(productId)) {
        const existing = productMap.get(productId);
        existing.totalOrders += 1;
        existing.totalRevenue += order.total_rental_price || 0;
      } else {
        productMap.set(productId, {
          id: productId,
          name: product?.[0]?.title || 'Unknown',
          category: product?.[0]?.category || 'Uncategorized',
          totalOrders: 1,
          totalRevenue: order.total_rental_price || 0
        });
      }
    });

    // Sort and limit results
    const sortedProducts = Array.from(productMap.values())
      .sort((a, b) => sortBy === 'revenue' ? b.totalRevenue - a.totalRevenue : b.totalOrders - a.totalOrders)
      .slice(0, limit);

    // Get category breakdown
    const categoryMap = new Map();
    topProducts?.forEach(order => {
      const category = order.products[0]?.category || 'Uncategorized';
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category);
        existing.count += 1;
        existing.revenue += order.total_rental_price || 0;
      } else {
        categoryMap.set(category, {
          category,
          count: 1,
          revenue: order.total_rental_price || 0
        });
      }
    });

    return {
      topProducts: sortedProducts,
      categoryBreakdown: Array.from(categoryMap.values())
    };
  } catch (error) {
    console.error('Error in getProductAnalytics:', error);
    throw new Error(`Failed to fetch product analytics: ${error}`);
  }
}

// Active users breakdown
export async function getActiveUsersBreakdown(timeframe: string): Promise<ActiveUsersBreakdown> {
  const days = timeframeToDays(timeframe);
  const startDate = formatDateForSupabase(days);
  
  try {
    // Get users who made orders (buyers)
    const { data: buyers } = await supabaseDB
      .from('orders')
      .select('buyer_id')
      .gte('created_at', startDate);

    // Get users who have products listed (sellers)
    const { data: sellers } = await supabaseDB
      .from('orders')
      .select('seller_id')
      .gte('created_at', startDate);

    const uniqueBuyers = new Set(buyers?.map(b => b.buyer_id) || []);
    const uniqueSellers = new Set(sellers?.map(s => s.seller_id) || []);
    const both = new Set([...uniqueBuyers].filter(id => uniqueSellers.has(id)));

    return {
      count: uniqueBuyers.size + uniqueSellers.size - both.size,
      percentage: 0, // Calculate based on total users if needed
      breakdown: {
        buyers: uniqueBuyers.size - both.size,
        sellers: uniqueSellers.size - both.size,
        both: both.size
      }
    };
  } catch (error) {
    console.error('Error in getActiveUsersBreakdown:', error);
    throw new Error(`Failed to fetch active users breakdown: ${error}`);
  }
}

// Helper functions for processing trend data
function processUserTrendsData(data: any[], period: string, days: number): TrendData[] {
  const trends: TrendData[] = [];
  const dateMap = new Map();
  
  data.forEach(user => {
    const date = period === 'daily' 
      ? new Date(user.created_at).toISOString().split('T')[0]
      : getWeekStart(new Date(user.created_at));
    
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  });
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i < (period === 'daily' ? days : Math.ceil(days / 7)); i++) {
    const date = new Date(startDate);
    if (period === 'daily') {
      date.setDate(date.getDate() + i);
    } else {
      date.setDate(date.getDate() + (i * 7));
    }
    
    const dateKey = period === 'daily' 
      ? date.toISOString().split('T')[0]
      : getWeekStart(date);
    
    trends.push({
      date: dateKey,
      newUsers: dateMap.get(dateKey) || 0
    });
  }
  
  return trends;
}

function processOrderTrendsData(data: any[], period: string, days: number): TrendData[] {
  const trends: TrendData[] = [];
  const dateMap = new Map();
  
  data.forEach(order => {
    const date = period === 'daily' 
      ? new Date(order.created_at).toISOString().split('T')[0]
      : getWeekStart(new Date(order.created_at));
    
    if (!dateMap.has(date)) {
      dateMap.set(date, { totalOrders: 0, completedOrders: 0, cancelledOrders: 0, totalRevenue: 0 });
    }
    
    const dayData = dateMap.get(date);
    dayData.totalOrders += 1;
    
    if (['completed', 'delivered'].includes(order.order_status)) {
      dayData.completedOrders += 1;
      dayData.totalRevenue += order.total_rental_price || 0;
    } else if (order.order_status === 'cancelled') {
      dayData.cancelledOrders += 1;
    }
  });
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i < (period === 'daily' ? days : Math.ceil(days / 7)); i++) {
    const date = new Date(startDate);
    if (period === 'daily') {
      date.setDate(date.getDate() + i);
    } else {
      date.setDate(date.getDate() + (i * 7));
    }
    
    const dateKey = period === 'daily' 
      ? date.toISOString().split('T')[0]
      : getWeekStart(date);
    
    const dayData = dateMap.get(dateKey) || { totalOrders: 0, completedOrders: 0, cancelledOrders: 0, totalRevenue: 0 };
    
    trends.push({
      date: dateKey,
      ...dayData
    });
  }
  
  return trends;
}

function processRevenueTrendsData(data: any[], period: string, days: number): TrendData[] {
  const trends: TrendData[] = [];
  const dateMap = new Map();
  
  data.forEach(order => {
    const date = period === 'daily' 
      ? new Date(order.created_at).toISOString().split('T')[0]
      : getWeekStart(new Date(order.created_at));
    
    if (!dateMap.has(date)) {
      dateMap.set(date, { grossRevenue: 0, commission: 0, damageFees: 0 });
    }
    
    const dayData = dateMap.get(date);
    dayData.grossRevenue += order.total_rental_price || 0;
    dayData.commission += order.security_deposit || 0; // Assuming commission is part of security deposit
    dayData.damageFees += order.damage_fee || 0;
  });
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i < (period === 'daily' ? days : Math.ceil(days / 7)); i++) {
    const date = new Date(startDate);
    if (period === 'daily') {
      date.setDate(date.getDate() + i);
    } else {
      date.setDate(date.getDate() + (i * 7));
    }
    
    const dateKey = period === 'daily' 
      ? date.toISOString().split('T')[0]
      : getWeekStart(date);
    
    const dayData = dateMap.get(dateKey) || { grossRevenue: 0, commission: 0, damageFees: 0 };
    
    trends.push({
      date: dateKey,
      ...dayData,
      netRevenue: dayData.grossRevenue - dayData.commission
    });
  }
  
  return trends;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

// Placeholder functions for additional analytics
export async function getCategoryInsights(timeframe: string) {
  return { categories: [] };
}

export async function getGeographicInsights(metric: string, timeframe: string, limit: number) {
  return { locations: [] };
}

export async function getConversionFunnel(timeframe: string) {
  return { stages: [] };
}

export async function getPlatformHealth() {
  return { 
    uptime: '99.9%',
    activeConnections: 0,
    avgResponseTime: 0
  };
}

export async function getRealTimeData() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const { count: todayOrders } = await supabaseDB
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);
  
  const { count: todayUsers } = await supabaseDB
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);
  
  return {
    todayOrders: todayOrders || 0,
    todayUsers: todayUsers || 0,
    onlineUsers: 0,
    lastUpdated: now.toISOString()
  };
}
