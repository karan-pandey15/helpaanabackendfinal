// routes/searchRoutes.js
const express = require('express');
const { search, suggestions, trending, advancedSearch } = require('../controllers/searchController');

const router = express.Router();

/**
 * @route GET /api/search
 * @desc Fuzzy search with dynamic related keywords
 * @query {string} query - Search query (required)
 * @query {number} limit - Results per page (optional, default: 10, max: 50)
 * @query {number} skip - Pagination offset (optional, default: 0)
 * 
 * Features:
 * - Fuzzy matching for typos and partial words
 * - Dynamic related keywords from product data
 * - Smart relevance scoring
 * - Fallback to broader search if needed
 */
router.get('/', search);

/**
 * @route GET /api/search/suggestions
 * @desc Get autocomplete suggestions with fuzzy matching
 * @query {string} q - Partial search input (min 2 chars)
 * 
 * Features:
 * - Exact and fuzzy matching
 * - Returns both product names and categories
 * - Max 10 suggestions
 */
router.get('/suggestions', suggestions);

/**
 * @route GET /api/search/trending
 * @desc Get trending categories
 * @query {number} limit - Number of trending items (optional, default: 10, max: 20)
 * 
 * Returns:
 * - Category names
 * - Product count per category
 * - Percentage of total products
 */
router.get('/trending', trending);

/**
 * @route GET /api/search/advanced
 * @desc Advanced search with filters
 * @query {string} query - Search query (optional)
 * @query {string} category - Filter by category (optional)
 * @query {number} minPrice - Minimum price (optional)
 * @query {number} maxPrice - Maximum price (optional)
 * @query {number} limit - Results per page (optional, default: 10, max: 50)
 * @query {number} skip - Pagination offset (optional, default: 0)
 * 
 * Features:
 * - Combine search with category and price filters
 * - Works with or without search query
 * - Fuzzy matching on product data
 */
router.get('/advanced', advancedSearch);

module.exports = router;