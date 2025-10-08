import { Router } from "express";
import {
  searchProducts,
  getAutocomplete,
  getPopularSearchesList,
  searchProductsByCategory,
  getFiltersMetadataController,
  getTrendingProductsList
} from "../controller/searchController";

const router = Router();

// Main search endpoint
// GET /api/search?q=wedding&category=costumes&minPrice=500&maxPrice=2000&page=1&limit=20
router.get('/', searchProducts);

// Autocomplete suggestions
// GET /api/search/autocomplete?q=wed&limit=10
router.get('/autocomplete', getAutocomplete);

// Popular searches
// GET /api/search/popular?limit=10
router.get('/popular', getPopularSearchesList);

// Trending products
// GET /api/search/trending?limit=10
router.get('/trending', getTrendingProductsList);

// Get filter metadata (categories, price ranges, sizes, etc.)
// GET /api/search/filters
router.get('/filters', getFiltersMetadataController);

// Category-specific search
// GET /api/search/category/costumes?minPrice=500&maxPrice=2000&page=1&limit=20
router.get('/category/:category', searchProductsByCategory);

export default router;