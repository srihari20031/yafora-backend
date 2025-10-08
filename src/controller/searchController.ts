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
  const { 
    q: query = '',
    page = 1,
    limit = 20,
    category,
    minPrice,
    maxPrice,
    availability,
    tryOnAvailable,
    sellerId,
    size
  } = req.query;

  try {
    const filters = {
      category: category as string | undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      availability: availability as string | undefined,
      tryOnAvailable: tryOnAvailable === 'true' ? true : tryOnAvailable === 'false' ? false : undefined,
      sellerId: sellerId as string | undefined,
      size: size as string | undefined
    };

    const result = await globalSearch(
      query as string,
      Number(page),
      Number(limit),
      filters
    );

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: result
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: (err as Error).message 
    });
  }
}

// Autocomplete suggestions endpoint
export async function getAutocomplete(req: Request, res: Response): Promise<void> {
  const { q: query = '', limit = 10 } = req.query;

  try {
    if (!query || (query as string).trim() === '') {
      res.status(200).json({
        success: true,
        message: 'No query provided',
        data: []
      });
      return;
    }

    const suggestions = await getAutocompleteSuggestions(
      query as string,
      Number(limit)
    );

    res.status(200).json({
      success: true,
      message: 'Autocomplete suggestions retrieved successfully',
      data: suggestions
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: (err as Error).message 
    });
  }
}

// Popular searches endpoint
export async function getPopularSearchesList(req: Request, res: Response): Promise<void> {
  const { limit = 10 } = req.query;

  try {
    const searches = await getPopularSearches(Number(limit));

    res.status(200).json({
      success: true,
      message: 'Popular searches retrieved successfully',
      data: searches
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: (err as Error).message 
    });
  }
}

// Category search endpoint
export async function searchProductsByCategory(req: Request, res: Response): Promise<void> {
  const { category } = req.params;
  const { 
    page = 1,
    limit = 20,
    minPrice,
    maxPrice,
    availability,
    tryOnAvailable,
    size
  } = req.query;

  try {
    const filters = {
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      availability: availability as string | undefined,
      tryOnAvailable: tryOnAvailable === 'true' ? true : tryOnAvailable === 'false' ? false : undefined,
      size: size as string | undefined
    };

    const result = await searchByCategory(
      category,
      Number(page),
      Number(limit),
      filters
    );

    res.status(200).json({
      success: true,
      message: `${category} products retrieved successfully`,
      data: result
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: (err as Error).message 
    });
  }
}

// Get filter metadata endpoint
export async function getFiltersMetadataController(req: Request, res: Response): Promise<void> {
  try {
    const metadata = await getSearchFiltersMetadata();

    res.status(200).json({
      success: true,
      message: 'Filter metadata retrieved successfully',
      data: metadata
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: (err as Error).message 
    });
  }
}

// Trending products endpoint
export async function getTrendingProductsList(req: Request, res: Response): Promise<void> {
  const { limit = 10 } = req.query;

  try {
    const products = await getTrendingProducts(Number(limit));

    res.status(200).json({
      success: true,
      message: 'Trending products retrieved successfully',
      data: products
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: (err as Error).message 
    });
  }
}