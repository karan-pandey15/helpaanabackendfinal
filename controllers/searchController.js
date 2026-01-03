
// controllers/searchController.js
// const Product = require('../models/Product');
const Product = require("../models/Product");

/**
 * UTILITY: Calculate Levenshtein distance (edit distance) between two strings
 * This measures how many single-character edits (insert, delete, substitute) 
 * are needed to change one word into another
 * 
 * Example:
 * - "product" to "profuct" = 2 edits (substitute 'd' with 'f', 't' with 't')
 * - "kitten" to "sitting" = 3 edits
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Levenshtein distance (lower is more similar)
 */
const levenshteinDistance = (str1, str2) => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  // Calculate distances
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = 1 + Math.min(
          matrix[j - 1][i],      // deletion
          matrix[j][i - 1],      // insertion
          matrix[j - 1][i - 1]   // substitution
        );
      }
    }
  }

  return matrix[len2][len1];
};

/**
 * UTILITY: Calculate similarity score based on Levenshtein distance
 * Returns a score from 0 to 100 where 100 = perfect match
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score 0-100
 */
const calculateSimilarity = (str1, str2) => {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(str1, str2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
};

/**
 * UTILITY: Sanitize search query
 * - Convert to lowercase
 * - Remove special characters but keep spaces for tokenization
 * - Remove extra spaces
 * @param {string} query - Raw search query from user
 * @returns {string} Cleaned query
 */
const sanitizeQuery = (query) => {
  if (!query) return '';
  
  return query
    .toLowerCase()
    .trim()
    // Remove special characters except spaces and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * UTILITY: Split query into searchable tokens
 * Example: "face wash" → ["face", "wash"]
 * @param {string} query - Sanitized query string
 * @returns {array} Array of search tokens
 */
const tokenizeQuery = (query) => {
  return query
    .split(' ')
    .filter(token => token.length > 0);
};

/**
 * UTILITY: Check if query tokens match a product name using advanced fuzzy logic
 * Handles:
 * - Typos (Levenshtein distance)
 * - Partial matches (substring matching)
 * - Character sequence matching (fuzzy regex)
 * 
 * @param {string} productName - Product name to check
 * @param {array} tokens - Search tokens
 * @returns {object} Match result with score and type
 */
const matchesProductName = (productName, tokens) => {
  const productNameL = (productName || '').toLowerCase();
  let maxSimilarity = 0;
  let matchType = 'none';

  for (const token of tokens) {
    const tokenL = token.toLowerCase();

    // 1. EXACT SUBSTRING MATCH (highest priority)
    if (productNameL.includes(tokenL)) {
      return { matched: true, score: 100, type: 'exact_substring' };
    }

    // 2. LEVENSHTEIN DISTANCE MATCH (typo tolerance)
    // Allow up to 30% character difference for typo tolerance
    const similarity = calculateSimilarity(tokenL, productNameL);
    if (similarity >= 70) {
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchType = 'levenshtein';
      }
    }

    // 3. CHARACTER SEQUENCE MATCH (fuzzy regex)
    // Example: "lipsti" matches "lipstick" (contains all chars in order)
    const fuzzyPattern = tokenL.split('').join('.*');
    const fuzzyRegex = new RegExp(fuzzyPattern, 'i');
    if (fuzzyRegex.test(productNameL)) {
      const fuzzyScore = 80;
      if (fuzzyScore > maxSimilarity) {
        maxSimilarity = fuzzyScore;
        matchType = 'fuzzy_sequence';
      }
    }

    // 4. PARTIAL TOKEN MATCH (word starts with token)
    const words = productNameL.split(' ');
    for (const word of words) {
      if (word.startsWith(tokenL)) {
        const partialScore = 85;
        if (partialScore > maxSimilarity) {
          maxSimilarity = partialScore;
          matchType = 'partial_word';
        }
      }
    }
  }

  return {
    matched: maxSimilarity >= 70,
    score: maxSimilarity,
    type: matchType
  };
};

/**
 * UTILITY: Calculate advanced match score for ranking results
 * Uses multiple matching strategies for robust ranking
 * 
 * Scoring:
 * - Exact phrase match: 150 points
 * - Exact substring match: 100 points
 * - Levenshtein match (typo): 80-90 points
 * - Partial word match: 85 points
 * - Fuzzy sequence: 75 points
 * - Category match: 30-50 points
 * - Description match: 10-20 points
 * 
 * @param {object} product - Product document
 * @param {array} tokens - Search tokens
 * @param {string} fullQuery - Full search query
 * @returns {number} Match score
 */
const calculateAdvancedMatchScore = (product, tokens, fullQuery = '') => {
  let score = 0;
  const nameL = (product.name || '').toLowerCase();
  const categoryL = (product.category || '').toLowerCase();
  const descriptionL = (product.description || '').toLowerCase();
  const fullQueryL = fullQuery.toLowerCase();

  // 1. EXACT PHRASE MATCH IN NAME (highest priority)
  if (nameL === fullQueryL) {
    score += 200;
    return score;
  } else if (nameL.includes(fullQueryL)) {
    score += 150;
  }

  // 2. TOKEN-BASED MATCHING
  tokens.forEach(token => {
    const tokenL = token.toLowerCase();

    // Check name matching with multiple strategies
    const nameMatch = matchesProductName(product.name, [token]);
    if (nameMatch.matched) {
      score += nameMatch.score + 50; // Boost for name match
    }

    // 3. CATEGORY MATCHING
    if (categoryL.includes(tokenL)) {
      score += 40; // Exact match in category
    } else {
      const categorySimilarity = calculateSimilarity(tokenL, categoryL);
      if (categorySimilarity >= 70) {
        score += 20 + (categorySimilarity - 70); // Fuzzy match in category
      }
    }

    // 4. DESCRIPTION MATCHING (lowest priority)
    if (descriptionL && descriptionL.includes(tokenL)) {
      score += 10;
    }
  });

  return Math.max(score, 0);
};

/**
 * UTILITY: Build MongoDB query for initial product filtering
 * Uses exact regex matching to fetch candidates for scoring
 * 
 * @param {array} tokens - Search tokens
 * @returns {object} MongoDB filter object
 */
const buildInitialQuery = (tokens) => {
  if (tokens.length === 0) return {};

  const orConditions = [];

  tokens.forEach(token => {
    const tokenL = token.toLowerCase();
    
    // Search in name, category, and description
    orConditions.push({ name: { $regex: tokenL, $options: 'i' } });
    orConditions.push({ category: { $regex: tokenL, $options: 'i' } });
    orConditions.push({ description: { $regex: tokenL, $options: 'i' } });
  });

  return { $or: orConditions };
};

/**
 * UTILITY: Search ALL products with fuzzy matching
 * When initial query returns no results, search entire collection
 * and score all products for best typo matches
 * 
 * @param {array} tokens - Search tokens
 * @param {string} fullQuery - Full search query
 * @returns {Promise<array>} Array of scored products
 */
const fuzzySearchAllProducts = async (tokens, fullQuery) => {
  try {
    const allProducts = await Product.find({})
      .select('_id name category price images averageRating description')
      .lean()
      .exec();

    // Score each product against query
    return allProducts
      .map(product => ({
        product,
        score: calculateAdvancedMatchScore(product, tokens, fullQuery)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

  } catch (error) {
    console.error('Error in fuzzySearchAllProducts:', error);
    return [];
  }
};

/**
 * UTILITY: Dynamically generate related keywords from product results
 * Extracts unique categories and product names from found products
 * Returns diverse suggestions based on actual data
 * 
 * @param {array} foundProducts - Array of product objects found
 * @param {number} maxSuggestions - Maximum suggestions (default: 5)
 * @returns {Promise<array>} Array of related keyword suggestions
 */
const generateRelatedKeywords = async (foundProducts, maxSuggestions = 5) => {
  try {
    const relatedKeywords = new Set();

    // Extract categories from found products
    if (foundProducts && foundProducts.length > 0) {
      foundProducts.forEach(product => {
        if (product.category) {
          relatedKeywords.add(product.category);
        }
      });

      // Get other products from same categories
      const categories = [...new Set(foundProducts.map(p => p.category).filter(Boolean))];
      
      if (categories.length > 0) {
        const relatedProducts = await Product.find({
          category: { $in: categories },
          _id: { $nin: foundProducts.map(p => p._id) }
        })
          .select('name category')
          .limit(15)
          .lean();

        relatedProducts.forEach(product => {
          if (product.name) {
            relatedKeywords.add(product.name);
          }
        });
      }
    } else {
      // If no products found, return all categories
      const allCategories = await Product.distinct('category');
      allCategories.forEach(cat => {
        if (cat) relatedKeywords.add(cat);
      });
    }

    // Convert to array and limit results
    return Array.from(relatedKeywords)
      .filter(kw => kw && kw.length > 0)
      .slice(0, maxSuggestions);

  } catch (error) {
    console.error('Error generating related keywords:', error);
    return [];
  }
};

/**
 * UTILITY: Transform product for response
 * Returns only necessary fields to minimize payload size
 * 
 * @param {object} product - Full product document
 * @returns {object} Transformed product for API response
 */
const transformProductForResponse = (product) => {
  const slug = (product.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    _id: product._id,
    name: product.name,
    category: product.category || 'Uncategorized',
    price: product.price,
    image: product.images && product.images.length > 0 
      ? product.images[0].url 
      : null,
    averageRating: product.averageRating || 0,
    slug: slug || 'product',
  };
};

/**
 * MAIN SEARCH ENDPOINT
 * Advanced fuzzy search with Levenshtein distance for typo tolerance
 * 
 * Handles:
 * - "profuct" → finds "product"
 * - "karangagan" → finds "karantesting"
 * - Partial words, typos, and exact matches
 * 
 * @route GET /api/search
 * @query {string} query - Search query (required)
 * @query {number} limit - Results per page (default: 10, max: 50)
 * @query {number} skip - Pagination offset (default: 0)
 * @access Public
 */
const search = async (req, res) => {
  const rawQuery = req.query.query || '';
  let limit = parseInt(req.query.limit) || 10;
  let skip = parseInt(req.query.skip) || 0;

  // Validate query
  if (!rawQuery || rawQuery.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
      results: [],
      relatedKeywords: []
    });
  }

  // Enforce limits
  limit = Math.min(Math.max(limit, 1), 50);
  skip = Math.max(skip, 0);

  const cleanQuery = sanitizeQuery(rawQuery);
  const tokens = tokenizeQuery(cleanQuery);

  if (tokens.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid search query',
      results: [],
      relatedKeywords: []
    });
  }

  try {
    // Step 1: Try initial query with exact regex matching
    const initialFilter = buildInitialQuery(tokens);
    const initialProducts = await Product.find(initialFilter)
      .select('_id name category price images averageRating description')
      .lean()
      .exec();

    // Score the results
    let scoredResults = initialProducts
      .map(product => ({
        product,
        score: calculateAdvancedMatchScore(product, tokens, cleanQuery)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Step 2: If no results from initial query, search ALL products with fuzzy scoring
    if (scoredResults.length === 0) {
      console.log(`No initial matches for "${cleanQuery}", performing full fuzzy search...`);
      scoredResults = await fuzzySearchAllProducts(tokens, cleanQuery);
    }

    let resultType = 'exact';
    let responseMessage = '';
    let paginatedResults = [];
    let relatedSuggestions = [];
    let total = 0;

    // Step 3: Format and paginate results
    if (scoredResults.length > 0) {
      resultType = 'exact';
      responseMessage = `Found ${scoredResults.length} results for "${cleanQuery}"`;
      const transformedResults = scoredResults.map(item => transformProductForResponse(item.product));
      total = transformedResults.length;
      paginatedResults = transformedResults.slice(skip, skip + limit);

      // Generate related keywords from top results
      relatedSuggestions = await generateRelatedKeywords(
        scoredResults.slice(0, 10).map(r => r.product),
        5
      );
    } else {
      // No results found at all
      resultType = 'empty';
      responseMessage = `No products found for "${cleanQuery}". Try different keywords.`;
      total = 0;
      paginatedResults = [];

      // Get all categories as suggestions
      const allCategories = await Product.distinct('category');
      relatedSuggestions = allCategories
        .filter(cat => cat && cat.length > 0)
        .slice(0, 5);
    }

    // Calculate pagination info
    const hasMore = skip + limit < total;
    const page = Math.floor(skip / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      query: cleanQuery,
      type: resultType,
      message: responseMessage,
      results: paginatedResults,
      total,
      page,
      hasMore,
      relatedKeywords: relatedSuggestions,
      pagination: {
        limit,
        skip,
        totalPages
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed. Please try again.',
      error: error.message,
      results: [],
      relatedKeywords: []
    });
  }
};

/**
 * SUGGESTIONS ENDPOINT
 * Returns autocomplete suggestions with advanced fuzzy matching
 * 
 * @route GET /api/search/suggestions
 * @query {string} q - Partial search input
 * @access Public
 */
const suggestions = async (req, res) => {
  const partialQuery = req.query.q || '';

  if (partialQuery.length < 1) {
    return res.json({ suggestions: [] });
  }

  try {
    const partialL = partialQuery.toLowerCase();

    // Search with regex matching
    const [nameMatches, categoryMatches] = await Promise.all([
      Product.find({ name: { $regex: partialL, $options: 'i' } })
        .select('name')
        .limit(8)
        .lean(),
      Product.find({ category: { $regex: partialL, $options: 'i' } })
        .select('category')
        .limit(8)
        .lean()
    ]);

    const suggestionsSet = new Map();

    // Add product names
    nameMatches.forEach(doc => {
      if (!suggestionsSet.has(doc.name.toLowerCase())) {
        suggestionsSet.set(doc.name.toLowerCase(), { 
          text: doc.name, 
          type: 'product'
        });
      }
    });

    // Add categories
    categoryMatches.forEach(doc => {
      if (!suggestionsSet.has(doc.category.toLowerCase())) {
        suggestionsSet.set(doc.category.toLowerCase(), { 
          text: doc.category, 
          type: 'category'
        });
      }
    });

    // Get all products and score against partial query
    if (suggestionsSet.size < 10) {
      const allProducts = await Product.find({})
        .select('name category')
        .lean()
        .exec();

      allProducts.forEach(product => {
        // Check name similarity
        const nameSimilarity = calculateSimilarity(partialL, product.name.toLowerCase());
        if (nameSimilarity >= 60 && !suggestionsSet.has(product.name.toLowerCase())) {
          suggestionsSet.set(product.name.toLowerCase(), {
            text: product.name,
            type: 'product',
            similarity: nameSimilarity
          });
        }

        // Check category similarity
        const categorySimilarity = calculateSimilarity(partialL, product.category.toLowerCase());
        if (categorySimilarity >= 60 && !suggestionsSet.has(product.category.toLowerCase())) {
          suggestionsSet.set(product.category.toLowerCase(), {
            text: product.category,
            type: 'category',
            similarity: categorySimilarity
          });
        }
      });
    }

    const suggestions = Array.from(suggestionsSet.values())
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, 10)
      .map(s => ({ text: s.text, type: s.type }));

    res.json({
      suggestions: suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      suggestions: [],
      error: error.message
    });
  }
};

/**
 * TRENDING ENDPOINT
 * Returns popular product categories
 * 
 * @route GET /api/search/trending
 * @query {number} limit - Number of categories (default: 10, max: 20)
 * @access Public
 */
const trending = async (req, res) => {
  try {
    let limit = parseInt(req.query.limit) || 10;
    limit = Math.min(Math.max(limit, 1), 20);

    const categories = await Product.distinct('category');
    
    const categoryStats = await Promise.all(
      categories.map(async (category) => ({
        name: category,
        count: await Product.countDocuments({ category })
      }))
    );

    const total = categoryStats.reduce((sum, cat) => sum + cat.count, 0);

    const trending = categoryStats
      .map(cat => ({
        ...cat,
        percentage: total > 0 ? ((cat.count / total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    res.json({ 
      trending,
      totalCategories: categories.length,
      totalProducts: total
    });

  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({
      trending: [],
      error: error.message
    });
  }
};

/**
 * ADVANCED SEARCH ENDPOINT
 * Allows filtering by category, price range, and fuzzy search
 * Fully dynamic - no hardcoded values
 * 
 * @route GET /api/search/advanced
 * @query {string} query - Search query
 * @query {string} category - Filter by category
 * @query {number} minPrice - Minimum price
 * @query {number} maxPrice - Maximum price
 * @query {number} limit - Results per page (default: 10, max: 50)
 * @query {number} skip - Pagination offset (default: 0)
 * @access Public
 */
const advancedSearch = async (req, res) => {
  const { query: rawQuery, category, minPrice, maxPrice } = req.query;
  let limit = parseInt(req.query.limit) || 10;
  let skip = parseInt(req.query.skip) || 0;

  limit = Math.min(Math.max(limit, 1), 50);
  skip = Math.max(skip, 0);

  try {
    let filter = {};

    // Add category filter
    if (category && category.length > 0) {
      filter.category = new RegExp(category, 'i');
    }

    // Add price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) {
        filter.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice !== undefined) {
        filter.price.$lte = parseFloat(maxPrice);
      }
    }

    // Add query filter if provided
    let tokens = [];
    let cleanQuery = '';
    if (rawQuery && rawQuery.trim().length > 0) {
      cleanQuery = sanitizeQuery(rawQuery);
      tokens = tokenizeQuery(cleanQuery);
      const queryFilter = buildInitialQuery(tokens);
      filter = { ...filter, $or: queryFilter.$or };
    }

    // Execute search
    const products = await Product.find(filter)
      .select('_id name category price images averageRating description')
      .lean()
      .exec();

    // Score and sort if query provided
    let results = products;
    if (tokens.length > 0) {
      results = products
        .map(product => ({
          product,
          score: calculateAdvancedMatchScore(product, tokens, cleanQuery)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);
    }

    // Apply pagination
    const total = results.length;
    const paginatedResults = results
      .map(product => transformProductForResponse(product))
      .slice(skip, skip + limit);

    const hasMore = skip + limit < total;
    const page = Math.floor(skip / limit) + 1;

    res.json({
      success: true,
      results: paginatedResults,
      total,
      page,
      hasMore,
      pagination: {
        limit,
        skip,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      success: false,
      message: 'Advanced search failed',
      error: error.message,
      results: []
    });
  }
};

// Export all functions
module.exports = {
  search,
  suggestions,
  trending,
  advancedSearch,
  // Export helper functions for testing
  levenshteinDistance,
  calculateSimilarity,
  matchesProductName,
  calculateAdvancedMatchScore
};
