import supabaseDB from "../../config/connectDB";

interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  tryOnAvailable?: boolean;
  sellerId?: string;
  size?: string;
}

interface SearchResult {
  products: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  suggestions: {
    categories: string[];
    priceRanges: { label: string; min: number; max: number }[];
  };
  filters: SearchFilters;
}

// Main search function
export async function globalSearch(
  query: string,
  page: number = 1,
  limit: number = 20,
  filters: SearchFilters = {}
): Promise<SearchResult> {
  const offset = (page - 1) * limit;

  // Build the base query
  let dbQuery = supabaseDB
    .from('products')
    .select(`
      *,
      seller:profiles!products_seller_id_fkey (
        id,
        full_name,
        email,
        profile_picture_url
      ),
      reviews:reviews (
        rating
      )
    `, { count: 'exact' });

  // Apply text search on title and description
  if (query && query.trim() !== '') {
    const searchTerm = query.trim().toLowerCase();
    dbQuery = dbQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
  }

  // Apply filters
  if (filters.category) {
    dbQuery = dbQuery.eq('category', filters.category);
  }

  if (filters.minPrice !== undefined) {
    dbQuery = dbQuery.gte('rental_price_per_day', filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    dbQuery = dbQuery.lte('rental_price_per_day', filters.maxPrice);
  }

  if (filters.availability) {
    dbQuery = dbQuery.eq('availability_status', filters.availability);
  } else {
    // By default, only show available products
    dbQuery = dbQuery.eq('availability_status', 'available');
  }

  if (filters.tryOnAvailable !== undefined) {
    dbQuery = dbQuery.eq('try_on_available', filters.tryOnAvailable);
  }

  if (filters.sellerId) {
    dbQuery = dbQuery.eq('seller_id', filters.sellerId);
  }

  if (filters.size) {
    dbQuery = dbQuery.eq('size', filters.size);
  }

  // Only show products that are marked as available
  dbQuery = dbQuery.eq('available', true);

  // Order by relevance (featured first, then by creation date)
  dbQuery = dbQuery
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await dbQuery;

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }

  // Calculate average rating for each product
  const productsWithRatings = data?.map((product: any) => {
    const reviews = product.reviews || [];
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : 0;
    
    return {
      ...product,
      average_rating: avgRating,
      total_reviews: reviews.length,
      reviews: undefined // Remove the reviews array from response
    };
  }) || [];

  // Get search suggestions
  const suggestions = await getSearchSuggestions(query, filters);

  return {
    products: productsWithRatings,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    suggestions,
    filters
  };
}

// Get search suggestions based on query
export async function getSearchSuggestions(
  query: string,
  currentFilters: SearchFilters = {}
) {
  // Get matching categories
  const categories = ['costumes', 'jewelry', 'formal_wear', 'accessories'];
  const matchingCategories = query
    ? categories.filter(cat => 
        cat.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(cat.toLowerCase())
      )
    : categories;

  // Define price ranges for suggestions
  const priceRanges = [
    { label: 'Under ₹500', min: 0, max: 500 },
    { label: '₹500 - ₹1000', min: 500, max: 1000 },
    { label: '₹1000 - ₹2000', min: 1000, max: 2000 },
    { label: '₹2000 - ₹5000', min: 2000, max: 5000 },
    { label: 'Above ₹5000', min: 5000, max: 999999 }
  ];

  return {
    categories: matchingCategories,
    priceRanges
  };
}

// Get autocomplete suggestions
export async function getAutocompleteSuggestions(query: string, limit: number = 10) {
  if (!query || query.trim() === '') {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  const { data, error } = await supabaseDB
    .from('products')
    .select('id, title, category, images, rental_price_per_day')
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .eq('available', true)
    .eq('availability_status', 'available')
    .order('is_featured', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch autocomplete suggestions: ${error.message}`);
  }

  return data?.map(product => ({
    id: product.id,
    title: product.title,
    category: product.category,
    image: product.images?.[0] || null,
    price: product.rental_price_per_day
  })) || [];
}

// Get popular searches
export async function getPopularSearches(limit: number = 10) {
  // This would ideally track search queries in a separate table
  // For now, return popular categories and featured products
  
  const { data, error } = await supabaseDB
    .from('products')
    .select('title, category, id')
    .eq('is_featured', true)
    .eq('available', true)
    .eq('availability_status', 'available')
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch popular searches: ${error.message}`);
  }

  return data?.map(product => ({
    query: product.title,
    category: product.category,
    productId: product.id
  })) || [];
}

// Get category-specific products
export async function searchByCategory(
  category: string,
  page: number = 1,
  limit: number = 20,
  filters: Omit<SearchFilters, 'category'> = {}
) {
  return globalSearch('', page, limit, { ...filters, category });
}

// Get search filters metadata
export async function getSearchFiltersMetadata() {
  // Get available categories
  const categories = [
    { value: 'costumes', label: 'Costumes' },
    { value: 'jewelry', label: 'Jewelry' },
    { value: 'formal_wear', label: 'Formal Wear' },
    { value: 'accessories', label: 'Accessories' }
  ];

  // Get price range from existing products
  const { data: priceData, error: priceError } = await supabaseDB
    .from('products')
    .select('rental_price_per_day')
    .eq('available', true)
    .eq('availability_status', 'available')
    .order('rental_price_per_day', { ascending: true });

  if (priceError) {
    throw new Error(`Failed to fetch price range: ${priceError.message}`);
  }

  const prices = priceData?.map(p => p.rental_price_per_day) || [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 10000;

  // Get available sizes
  const { data: sizeData, error: sizeError } = await supabaseDB
    .from('products')
    .select('size')
    .eq('available', true)
    .eq('availability_status', 'available')
    .not('size', 'is', null);

  if (sizeError) {
    throw new Error(`Failed to fetch sizes: ${sizeError.message}`);
  }

  const uniqueSizes = [...new Set(sizeData?.map(p => p.size).filter(Boolean))];

  return {
    categories,
    priceRange: {
      min: minPrice,
      max: maxPrice
    },
    sizes: uniqueSizes.map(size => ({ value: size, label: size })),
    availabilityOptions: [
      { value: 'available', label: 'Available' },
      { value: 'booked', label: 'Booked' },
      { value: 'unavailable', label: 'Unavailable' }
    ]
  };
}

// Get trending products
export async function getTrendingProducts(limit: number = 10) {
  // Get products with most orders in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orderData, error: orderError } = await supabaseDB
    .from('orders')
    .select('product_id')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .eq('order_status', 'completed');

  if (orderError) {
    throw new Error(`Failed to fetch trending products: ${orderError.message}`);
  }

  // Count product occurrences
  const productCounts = orderData?.reduce((acc: any, order: any) => {
    acc[order.product_id] = (acc[order.product_id] || 0) + 1;
    return acc;
  }, {}) || {};

  // Get top product IDs
  const trendingProductIds = Object.entries(productCounts)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, limit)
    .map(([id]) => id);

  if (trendingProductIds.length === 0) {
    // If no trending products, return featured products
    const { data: featuredData, error: featuredError } = await supabaseDB
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey (
          id,
          full_name
        ),
        reviews:reviews (
          rating
        )
      `)
      .eq('is_featured', true)
      .eq('available', true)
      .eq('availability_status', 'available')
      .limit(limit);

    if (featuredError) {
      throw new Error(`Failed to fetch featured products: ${featuredError.message}`);
    }

    return featuredData || [];
  }

  // Get product details
  const { data, error } = await supabaseDB
    .from('products')
    .select(`
      *,
      seller:profiles!products_seller_id_fkey (
        id,
        full_name
      ),
      reviews:reviews (
        rating
      )
    `)
    .in('id', trendingProductIds)
    .eq('available', true)
    .eq('availability_status', 'available');

  if (error) {
    throw new Error(`Failed to fetch trending products details: ${error.message}`);
  }

  // Calculate average ratings
  const productsWithRatings = data?.map((product: any) => {
    const reviews = product.reviews || [];
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : 0;
    
    return {
      ...product,
      average_rating: avgRating,
      total_reviews: reviews.length,
      order_count: productCounts[product.id],
      reviews: undefined
    };
  }) || [];

  // Sort by order count
  productsWithRatings.sort((a, b) => b.order_count - a.order_count);

  return productsWithRatings;
}