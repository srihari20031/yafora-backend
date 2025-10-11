import supabaseDB from "../../config/connectDB";

interface SearchFilters {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  tryOnAvailable?: boolean;
  sellerId?: string;
  size?: string;
  featured?: boolean;
  color?: string;
  material?: string;
  tags?: string[];
  occasion_tags?: string[];
  condition?: string;
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
  const startTime = Date.now();
  const offset = (page - 1) * limit;

  console.log('🔍 [SERVICE] globalSearch called:', {
    query,
    page,
    limit,
    offset,
    filters: JSON.stringify(filters, null, 2),
    timestamp: new Date().toISOString()
  });

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

  console.log('🔍 [SERVICE] Base query constructed');

  // Apply text search on multiple fields
  if (query && query.trim() !== '') {
    const searchTerm = query.trim().toLowerCase();
    console.log('🔍 [SERVICE] Applying text search:', { searchTerm });
    dbQuery = dbQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,subcategory.ilike.%${searchTerm}%,color.ilike.%${searchTerm}%,secondary_color.ilike.%${searchTerm}%,material.ilike.%${searchTerm}%,condition.ilike.%${searchTerm}%`);
  }

  // Apply filters
  const appliedFilters: string[] = [];
  
  if (filters.category) {
    dbQuery = dbQuery.eq('category', filters.category);
    appliedFilters.push(`category=${filters.category}`);
  }

  if (filters.minPrice !== undefined) {
    dbQuery = dbQuery.gte('rental_price_per_day', filters.minPrice);
    appliedFilters.push(`minPrice=${filters.minPrice}`);
  }

  if (filters.maxPrice !== undefined) {
    dbQuery = dbQuery.lte('rental_price_per_day', filters.maxPrice);
    appliedFilters.push(`maxPrice=${filters.maxPrice}`);
  }

  if (filters.availability) {
    dbQuery = dbQuery.eq('availability_status', filters.availability);
    appliedFilters.push(`availability=${filters.availability}`);
  } else {
    // By default, only show available products
    dbQuery = dbQuery.eq('availability_status', 'available');
    appliedFilters.push('availability=available (default)');
  }

  if (filters.tryOnAvailable !== undefined) {
    dbQuery = dbQuery.eq('try_on_available', filters.tryOnAvailable);
    appliedFilters.push(`tryOnAvailable=${filters.tryOnAvailable}`);
  }

  if (filters.sellerId) {
    dbQuery = dbQuery.eq('seller_id', filters.sellerId);
    appliedFilters.push(`sellerId=${filters.sellerId}`);
  }

  if (filters.size) {
    dbQuery = dbQuery.eq('size', filters.size);
    appliedFilters.push(`size=${filters.size}`);
  }

  if (filters.subcategory) {
    dbQuery = dbQuery.eq('subcategory', filters.subcategory);
    appliedFilters.push(`subcategory=${filters.subcategory}`);
  }

  if (filters.featured) {
    dbQuery = dbQuery.eq('is_featured', true);
    appliedFilters.push('featured=true');
  }

  if (filters.color) {
    dbQuery = dbQuery.eq('color', filters.color);
    appliedFilters.push(`color=${filters.color}`);
  }

  if (filters.material) {
    dbQuery = dbQuery.eq('material', filters.material);
    appliedFilters.push(`material=${filters.material}`);
  }

  if (filters.tags && filters.tags.length > 0) {
    dbQuery = dbQuery.contains('tags', filters.tags);
    appliedFilters.push(`tags=[${filters.tags.join(', ')}]`);
  }

  if (filters.occasion_tags && filters.occasion_tags.length > 0) {
    dbQuery = dbQuery.contains('occasion_tags', filters.occasion_tags);
    appliedFilters.push(`occasion_tags=[${filters.occasion_tags.join(', ')}]`);
  }

  if (filters.condition) {
    dbQuery = dbQuery.eq('condition', filters.condition);
    appliedFilters.push(`condition=${filters.condition}`);
  }

  // Only show products that are marked as available
  dbQuery = dbQuery.eq('available', true);
  appliedFilters.push('available=true');

  console.log('🔍 [SERVICE] Applied filters:', appliedFilters);

  // Order by relevance (featured first, then by creation date)
  dbQuery = dbQuery
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  console.log('🔍 [SERVICE] Executing query with range:', { offset, end: offset + limit - 1 });

  const queryStartTime = Date.now();
  const { data, error, count } = await dbQuery;
  const queryDuration = Date.now() - queryStartTime;

  console.log('🔍 [SERVICE] Query executed:', {
    duration: `${queryDuration}ms`,
    resultsCount: data?.length || 0,
    totalCount: count,
    hasError: !!error
  });

  if (error) {
    console.error('❌ [SERVICE] Database query error:', {
      message: error.message,
      details: error,
      query,
      filters
    });
    throw new Error(`Failed to search products: ${error.message}`);
  }

  // Calculate average rating for each product
  console.log('🔍 [SERVICE] Calculating ratings for products...');
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

  console.log('🔍 [SERVICE] Ratings calculated for', productsWithRatings.length, 'products');

  // Get search suggestions
  console.log('🔍 [SERVICE] Fetching search suggestions...');
  const suggestionsStartTime = Date.now();
  const suggestions = await getSearchSuggestions(query, filters);
  const suggestionsDuration = Date.now() - suggestionsStartTime;
  
  console.log('🔍 [SERVICE] Suggestions fetched:', {
    duration: `${suggestionsDuration}ms`,
    categoriesCount: suggestions.categories.length,
    priceRangesCount: suggestions.priceRanges.length
  });

  const totalDuration = Date.now() - startTime;
  console.log('✅ [SERVICE] globalSearch completed:', {
    totalDuration: `${totalDuration}ms`,
    productsReturned: productsWithRatings.length,
    totalResults: count,
    page,
    totalPages: Math.ceil((count || 0) / limit)
  });

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
  console.log('💡 [SERVICE] getSearchSuggestions called:', { query, currentFilters });

  // Get matching categories
  const categories = ['women_wear', 'men_wear', 'kids_wear', 'jewelry', 'swami_sets', 'special_occasion', 'other'];
  const matchingCategories = query
    ? categories.filter(cat =>
        cat.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(cat.toLowerCase())
      )
    : categories;

  console.log('💡 [SERVICE] Matching categories:', matchingCategories);

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
  const startTime = Date.now();
  
  console.log('💡 [SERVICE] getAutocompleteSuggestions called:', { query, limit });

  if (!query || query.trim() === '') {
    console.log('⚠️ [SERVICE] Empty query in autocomplete, returning empty array');
    return [];
  }

  const searchTerm = query.trim().toLowerCase();
  console.log('💡 [SERVICE] Searching autocomplete with term:', searchTerm);

  const queryStartTime = Date.now();
  const { data, error } = await supabaseDB
    .from('products')
    .select('id, title, category, images, rental_price_per_day')
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,subcategory.ilike.%${searchTerm}%,color.ilike.%${searchTerm}%,secondary_color.ilike.%${searchTerm}%,material.ilike.%${searchTerm}%,condition.ilike.%${searchTerm}%`)
    .eq('available', true)
    .eq('availability_status', 'available')
    .order('is_featured', { ascending: false })
    .limit(limit);
  
  const queryDuration = Date.now() - queryStartTime;

  console.log('💡 [SERVICE] Autocomplete query executed:', {
    duration: `${queryDuration}ms`,
    resultsCount: data?.length || 0,
    hasError: !!error
  });

  if (error) {
    console.error('❌ [SERVICE] Autocomplete query error:', {
      message: error.message,
      details: error,
      query
    });
    throw new Error(`Failed to fetch autocomplete suggestions: ${error.message}`);
  }

  const suggestions = data?.map(product => ({
    id: product.id,
    title: product.title,
    category: product.category,
    image: product.images?.[0] || null,
    price: product.rental_price_per_day
  })) || [];

  const totalDuration = Date.now() - startTime;
  console.log('✅ [SERVICE] Autocomplete completed:', {
    totalDuration: `${totalDuration}ms`,
    suggestionsReturned: suggestions.length
  });

  return suggestions;
}

// Get popular searches
export async function getPopularSearches(limit: number = 10) {
  const startTime = Date.now();
  
  console.log('🔥 [SERVICE] getPopularSearches called:', { limit });
  
  // This would ideally track search queries in a separate table
  // For now, return popular categories and featured products
  
  const { data, error } = await supabaseDB
    .from('products')
    .select('title, category, id')
    .eq('is_featured', true)
    .eq('available', true)
    .eq('availability_status', 'available')
    .limit(limit);

  console.log('🔥 [SERVICE] Popular searches query executed:', {
    duration: `${Date.now() - startTime}ms`,
    resultsCount: data?.length || 0,
    hasError: !!error
  });

  if (error) {
    console.error('❌ [SERVICE] Popular searches query error:', {
      message: error.message,
      details: error
    });
    throw new Error(`Failed to fetch popular searches: ${error.message}`);
  }

  const searches = data?.map(product => ({
    query: product.title,
    category: product.category,
    productId: product.id
  })) || [];

  console.log('✅ [SERVICE] Popular searches completed:', {
    totalDuration: `${Date.now() - startTime}ms`,
    searchesReturned: searches.length
  });

  return searches;
}

// Get category-specific products
export async function searchByCategory(
  category: string,
  page: number = 1,
  limit: number = 20,
  filters: Omit<SearchFilters, 'category'> = {}
) {
  console.log('📂 [SERVICE] searchByCategory called:', {
    category,
    page,
    limit,
    additionalFilters: JSON.stringify(filters, null, 2)
  });

  const result = await globalSearch('', page, limit, { ...filters, category });
  
  console.log('✅ [SERVICE] searchByCategory completed:', {
    category,
    resultsCount: result.products.length,
    totalResults: result.total
  });

  return result;
}

// Get search filters metadata
export async function getSearchFiltersMetadata() {
  const startTime = Date.now();
  
  console.log('⚙️ [SERVICE] getSearchFiltersMetadata called');

  // Get available categories
  const categories = [
    { value: 'women_wear', label: 'Women Wear' },
    { value: 'men_wear', label: 'Men Wear' },
    { value: 'kids_wear', label: 'Kids Wear' },
    { value: 'jewelry', label: 'Jewelry' },
    { value: 'swami_sets', label: 'Swami Sets' },
    { value: 'special_occasion', label: 'Special Occasion' },
    { value: 'other', label: 'Other' }
  ];

  console.log('⚙️ [SERVICE] Fetching price range...');

  // Get price range from existing products
  const priceQueryStart = Date.now();
  const { data: priceData, error: priceError } = await supabaseDB
    .from('products')
    .select('rental_price_per_day')
    .eq('available', true)
    .eq('availability_status', 'available')
    .order('rental_price_per_day', { ascending: true });

  console.log('⚙️ [SERVICE] Price range query executed:', {
    duration: `${Date.now() - priceQueryStart}ms`,
    resultsCount: priceData?.length || 0,
    hasError: !!priceError
  });

  if (priceError) {
    console.error('❌ [SERVICE] Price range query error:', {
      message: priceError.message,
      details: priceError
    });
    throw new Error(`Failed to fetch price range: ${priceError.message}`);
  }

  const prices = priceData?.map(p => p.rental_price_per_day) || [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 10000;

  console.log('⚙️ [SERVICE] Price range calculated:', { minPrice, maxPrice, totalProducts: prices.length });

  // Get available sizes
  console.log('⚙️ [SERVICE] Fetching sizes...');
  
  const sizesQueryStart = Date.now();
  const { data: sizeData, error: sizeError } = await supabaseDB
    .from('products')
    .select('size')
    .eq('available', true)
    .eq('availability_status', 'available')
    .not('size', 'is', null);

  console.log('⚙️ [SERVICE] Sizes query executed:', {
    duration: `${Date.now() - sizesQueryStart}ms`,
    resultsCount: sizeData?.length || 0,
    hasError: !!sizeError
  });

  if (sizeError) {
    console.error('❌ [SERVICE] Sizes query error:', {
      message: sizeError.message,
      details: sizeError
    });
    throw new Error(`Failed to fetch sizes: ${sizeError.message}`);
  }

  const uniqueSizes = [...new Set(sizeData?.map(p => p.size).filter(Boolean))];
  console.log('⚙️ [SERVICE] Unique sizes found:', uniqueSizes);

  const metadata = {
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

  console.log('✅ [SERVICE] getSearchFiltersMetadata completed:', {
    totalDuration: `${Date.now() - startTime}ms`,
    categoriesCount: categories.length,
    sizesCount: uniqueSizes.length,
    priceRange: { minPrice, maxPrice }
  });

  return metadata;
}

// Get trending products
export async function getTrendingProducts(limit: number = 10) {
  const startTime = Date.now();
  
  console.log('📈 [SERVICE] getTrendingProducts called:', { limit });

  // Get products with most orders in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log('📈 [SERVICE] Fetching orders from:', thirtyDaysAgo.toISOString());

  const ordersQueryStart = Date.now();
  const { data: orderData, error: orderError } = await supabaseDB
    .from('orders')
    .select('product_id')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .eq('order_status', 'completed');

  console.log('📈 [SERVICE] Orders query executed:', {
    duration: `${Date.now() - ordersQueryStart}ms`,
    ordersCount: orderData?.length || 0,
    hasError: !!orderError
  });

  if (orderError) {
    console.error('❌ [SERVICE] Orders query error:', {
      message: orderError.message,
      details: orderError
    });
    throw new Error(`Failed to fetch trending products: ${orderError.message}`);
  }

  // Count product occurrences
  const productCounts = orderData?.reduce((acc: any, order: any) => {
    acc[order.product_id] = (acc[order.product_id] || 0) + 1;
    return acc;
  }, {}) || {};

  console.log('📈 [SERVICE] Product order counts calculated:', {
    uniqueProducts: Object.keys(productCounts).length,
    topProducts: Object.entries(productCounts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }))
  });

  // Get top product IDs
  const trendingProductIds = Object.entries(productCounts)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, limit)
    .map(([id]) => id);

  console.log('📈 [SERVICE] Trending product IDs:', trendingProductIds);

  if (trendingProductIds.length === 0) {
    console.log('⚠️ [SERVICE] No trending products found, falling back to featured products');
    
    // If no trending products, return featured products
    const featuredQueryStart = Date.now();
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

    console.log('📈 [SERVICE] Featured products query executed:', {
      duration: `${Date.now() - featuredQueryStart}ms`,
      resultsCount: featuredData?.length || 0,
      hasError: !!featuredError
    });

    if (featuredError) {
      console.error('❌ [SERVICE] Featured products query error:', {
        message: featuredError.message,
        details: featuredError
      });
      throw new Error(`Failed to fetch featured products: ${featuredError.message}`);
    }

    console.log('✅ [SERVICE] getTrendingProducts completed (featured fallback):', {
      totalDuration: `${Date.now() - startTime}ms`,
      productsReturned: featuredData?.length || 0
    });

    return featuredData || [];
  }

  // Get product details
  console.log('📈 [SERVICE] Fetching product details for trending products...');
  
  const productsQueryStart = Date.now();
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

  console.log('📈 [SERVICE] Product details query executed:', {
    duration: `${Date.now() - productsQueryStart}ms`,
    resultsCount: data?.length || 0,
    hasError: !!error
  });

  if (error) {
    console.error('❌ [SERVICE] Product details query error:', {
      message: error.message,
      details: error
    });
    throw new Error(`Failed to fetch trending products details: ${error.message}`);
  }

  // Calculate average ratings
  console.log('📈 [SERVICE] Calculating ratings for trending products...');
  
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

  console.log('✅ [SERVICE] getTrendingProducts completed:', {
    totalDuration: `${Date.now() - startTime}ms`,
    productsReturned: productsWithRatings.length,
    topProduct: productsWithRatings[0] ? {
      id: productsWithRatings[0].id,
      title: productsWithRatings[0].title,
      orderCount: productsWithRatings[0].order_count
    } : null
  });

  return productsWithRatings;
}