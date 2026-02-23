import { Request, Response } from 'express';
import {
  globalSearch,
  getAutocompleteSuggestions,
  getPopularSearches,
  searchByCategory,
  getSearchFiltersMetadata,
  getTrendingProducts
} from '../services/searchService';

// Main global search endpoint
export async function searchProducts(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  const {
    q: query = '',
    page = 1,
    limit = 20,
    category,
    subcategory,
    minPrice,
    maxPrice,
    availability,
    tryOnAvailable,
    sellerId,
    size,
    color,
    material,
    condition,
    featured,
    tags,
    occasion_tags,
    groupByCategory
  } = req.query;

  console.log('🔍 [SEARCH] Incoming search request:', {
    query,
    page,
    limit,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  try {
    const filters = {
      category: category as string | undefined,
      subcategory: subcategory as string | undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      availability: availability as string | undefined,
      tryOnAvailable: tryOnAvailable === 'true' ? true : tryOnAvailable === 'false' ? false : undefined,
      sellerId: sellerId as string | undefined,
      size: size as string | undefined,
      color: color as string | undefined,
      material: material as string | undefined,
      condition: condition as string | undefined,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      tags: tags ? (tags as string).split(',').map(t => t.trim()) : undefined,
      occasion_tags: occasion_tags ? (occasion_tags as string).split(',').map(t => t.trim()) : undefined
    };

    console.log('🔍 [SEARCH] Applied filters:', JSON.stringify(filters, null, 2));

    const result = await globalSearch(
      query as string,
      Number(page),
      Number(limit),
      filters,
      groupByCategory === 'true'
    );

    const duration = Date.now() - startTime;

    console.log('✅ [SEARCH] Search completed successfully:', {
      query,
      resultsCount: result.products?.length || 0,
      totalResults: result.total || 0,
      duration: `${duration}ms`,
      page: result.page,
      totalPages: result.totalPages
    });

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: result
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    console.error('❌ [SEARCH] Search failed:', {
      query,
      error: (err as Error).message,
      stack: (err as Error).stack,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: (err as Error).message
    });
  }
}

// Autocomplete suggestions endpoint
// Supports optional ?category=<value> to scope results to a specific category
export async function getAutocomplete(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const {
    q: query = '',
    limit = 10,
    category // ← NEW: optional category scope
  } = req.query;

  console.log('💡 [AUTOCOMPLETE] Request received:', { query, limit, category });

  try {
    if (!query || (query as string).trim() === '') {
      console.log('⚠️ [AUTOCOMPLETE] Empty query provided');

      res.status(200).json({
        success: true,
        message: 'No query provided',
        data: []
      });
      return;
    }

    const suggestions = await getAutocompleteSuggestions(
      query as string,
      Number(limit),
      category as string | undefined  // ← pass category through
    );

    const duration = Date.now() - startTime;

    console.log('✅ [AUTOCOMPLETE] Suggestions retrieved:', {
      query,
      category: category || 'all',
      suggestionsCount: suggestions.length,
      duration: `${duration}ms`,
      suggestions: suggestions.slice(0, 3)
    });

    res.status(200).json({
      success: true,
      message: 'Autocomplete suggestions retrieved successfully',
      data: suggestions
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    console.error('❌ [AUTOCOMPLETE] Failed:', {
      query,
      error: (err as Error).message,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: (err as Error).message
    });
  }
}

// Popular searches endpoint
export async function getPopularSearchesList(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { limit = 10 } = req.query;

  console.log('🔥 [POPULAR] Fetching popular searches:', { limit });

  try {
    const searches = await getPopularSearches(Number(limit));

    const duration = Date.now() - startTime;

    console.log('✅ [POPULAR] Popular searches retrieved:', {
      count: searches.length,
      duration: `${duration}ms`,
      searches: searches.slice(0, 5)
    });

    res.status(200).json({
      success: true,
      message: 'Popular searches retrieved successfully',
      data: searches
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    console.error('❌ [POPULAR] Failed:', {
      error: (err as Error).message,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: (err as Error).message
    });
  }
}

// Category search endpoint
export async function searchProductsByCategory(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { category } = req.params;
  const {
    page = 1,
    limit = 20,
    subcategory,
    minPrice,
    maxPrice,
    availability,
    tryOnAvailable,
    size,
    color,
    material,
    condition,
    featured,
    tags,
    occasion_tags
  } = req.query;

  console.log('📂 [CATEGORY_SEARCH] Request received:', {
    category,
    page,
    limit,
    timestamp: new Date().toISOString()
  });

  try {
    const filters = {
      subcategory: subcategory as string | undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      availability: availability as string | undefined,
      tryOnAvailable: tryOnAvailable === 'true' ? true : tryOnAvailable === 'false' ? false : undefined,
      size: size as string | undefined,
      color: color as string | undefined,
      material: material as string | undefined,
      condition: condition as string | undefined,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      tags: tags ? (tags as string).split(',').map(t => t.trim()) : undefined,
      occasion_tags: occasion_tags ? (occasion_tags as string).split(',').map(t => t.trim()) : undefined
    };

    console.log('📂 [CATEGORY_SEARCH] Applied filters:', JSON.stringify(filters, null, 2));

    const result = await searchByCategory(
      category,
      Number(page),
      Number(limit),
      filters
    );

    const duration = Date.now() - startTime;

    console.log('✅ [CATEGORY_SEARCH] Search completed:', {
      category,
      resultsCount: result.products?.length || 0,
      totalResults: result.total || 0,
      duration: `${duration}ms`,
      page: result.page,
      totalPages: result.totalPages
    });

    res.status(200).json({
      success: true,
      message: `${category} products retrieved successfully`,
      data: result
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    console.error('❌ [CATEGORY_SEARCH] Failed:', {
      category,
      error: (err as Error).message,
      stack: (err as Error).stack,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: (err as Error).message
    });
  }
}

// Get filter metadata endpoint
export async function getFiltersMetadataController(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  console.log('⚙️ [FILTERS_METADATA] Fetching filter metadata');

  try {
    const metadata = await getSearchFiltersMetadata();

    const duration = Date.now() - startTime;

    console.log('✅ [FILTERS_METADATA] Metadata retrieved:', {
      duration: `${duration}ms`,
      categories: Object.keys(metadata).length
    });

    res.status(200).json({
      success: true,
      message: 'Filter metadata retrieved successfully',
      data: metadata
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    console.error('❌ [FILTERS_METADATA] Failed:', {
      error: (err as Error).message,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: (err as Error).message
    });
  }
}

// Trending products endpoint
export async function getTrendingProductsList(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const { limit = 10 } = req.query;

  console.log('📈 [TRENDING] Fetching trending products:', { limit });

  try {
    const products = await getTrendingProducts(Number(limit));

    const duration = Date.now() - startTime;

    console.log('✅ [TRENDING] Trending products retrieved:', {
      count: products.length,
      duration: `${duration}ms`,
      productIds: products.slice(0, 5).map((p: any) => p.id || p._id)
    });

    res.status(200).json({
      success: true,
      message: 'Trending products retrieved successfully',
      data: products
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    console.error('❌ [TRENDING] Failed:', {
      error: (err as Error).message,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: (err as Error).message
    });
  }
}