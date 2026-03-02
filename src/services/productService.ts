import supabaseDB from "../../config/connectDB";

export interface PieceDetail {
  piece_type: string;
  label: string;
  size: string;
  gender_fit?: string;
  measurements?: Record<string, string>;
}

export interface ProductPieceDetails {
  pieces: PieceDetail[];
}

export interface SellerAcknowledgements {
  ownership_accuracy: boolean;
  condition_hygiene: boolean;
  policy_agreement: boolean;
  acknowledged_at?: string;
}

export interface ProductData {
  id?: string;
  seller_id?: string;
  title: string;
  category: 'Women' | 'Men' | 'Goddess Wear' | 'Jewelry';
  subcategory?: string; // 'Lehenga' | 'Saree' | 'Suit' | 'Necklace' etc.
  description: string;
  images: string[]; // Max 10 images
  
  // NEW FIELDS
  cover_image_url?: string; // Auto-selected from images[0] if not provided
  available_sizes: string[]; // Required for non-jewelry items
  overall_size?: string; // Optional overall size (S, M, L, XL)
  item_type?: string; // For single items: 'Lehenga', 'Saree', etc.
  alteration_notes?: string; // Required if is_alteration_available = true
  seller_acknowledgements: SellerAcknowledgements;
  
  // PRICING
  rental_price_per_day: number;
  security_deposit_percentage: number; // Admin-controlled
  min_rental_days: number;
  max_rental_days: number;
  
  // PRODUCT DETAILS (OPTIONAL - not for jewelry)
  material?: string; // Fabric: 'Silk' | 'Net' | 'Georgette' | 'Cotton' | 'Mixed' | 'Other'
  color?: string; // Primary color
  secondary_color?: string;
  weight?: string; // Free text like "500g", "1kg"
  condition: 'new' | 'excellent' | 'good';
  
  // MEASUREMENTS (OPTIONAL - not for jewelry)
  chest_size?: string;
  waist_size?: string;
  hip_size?: string;
  length?: string;
  
  // MULTI-PIECE SUPPORT
  is_multi_piece: boolean;
  piece_details?: ProductPieceDetails | null;
  
  // SERVICES
  is_alteration_available: boolean;
  care_instructions?: string; // Free text
  
  // SEARCH & DISCOVERY
  tags?: string[]; // Custom tags for search
  occasion_tags?: string[];
  
  // METADATA
  availability_status: 'available' | 'unavailable' | 'booked';
  is_visible: boolean;
  is_featured?: boolean;
  target_gender?: 'women' | 'men' | 'unisex' | 'both';
  
  // TIMESTAMPS
  created_at?: string;
  updated_at?: string;
}

export interface ProductFilters {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  availability?: string;
  featured?: boolean;
  color?: string;
  material?: string;
  tags?: string[];
  occasion_tags?: string[];
  condition?: string;
}

/**
 * Check if product category is jewelry or goddess wear
 */
export const isJewelryType = (category: string): boolean => {
  return ['jewelry', 'jewellery', 'goddess_wear', 'goddess wear']
    .includes(category?.toLowerCase() || '');
};

/**
 * Check if a field is required based on product category
 */
export const isFieldRequired = (fieldName: string, category: string): boolean => {
  const isJewelry = isJewelryType(category);
  
  const optionalForJewelry = [
    'material',
    'color',
    'available_sizes',
    'overall_size',
    'chest_size',
    'waist_size',
    'hip_size',
    'length',
    'weight'
  ];
  
  if (isJewelry && optionalForJewelry.includes(fieldName)) {
    return false;
  }
  
  return true;
};

/**
 * Validate seller acknowledgements
 */
export const validateAcknowledgements = (acknowledgements: SellerAcknowledgements | undefined): void => {
  if (!acknowledgements?.ownership_accuracy || 
      !acknowledgements?.condition_hygiene || 
      !acknowledgements?.policy_agreement) {
    throw new Error('All seller acknowledgements must be accepted before submitting product');
  }
};

/**
 * Validate alteration notes
 */
export const validateAlterationNotes = (productData: ProductData): void => {
  if (productData.is_alteration_available && 
      (!productData.alteration_notes || productData.alteration_notes.trim() === '')) {
    throw new Error('Alteration notes are required when alteration is available');
  }
};

/**
 * Validate sizes for non-jewelry
 */
export const validateSizes = (productData: ProductData): void => {
  if (!isJewelryType(productData.category)) {
    if (!productData.available_sizes || productData.available_sizes.length === 0) {
      throw new Error('At least one size is required for non-jewelry products');
    }
  }
};

/**
 * Auto-set cover image if not provided
 */
export const autoSetCoverImage = (productData: ProductData): void => {
  if (!productData.cover_image_url && productData.images && productData.images.length > 0) {
    productData.cover_image_url = productData.images[0];
  }
};

/**
 * Set acknowledgement timestamp
 */
export const setAcknowledgementTimestamp = (productData: ProductData): void => {
  if (productData.seller_acknowledgements) {
    productData.seller_acknowledgements.acknowledged_at = new Date().toISOString();
  }
};

/**
 * Get validation errors for product data
 */
export const getProductValidationErrors = (productData: ProductData): string[] => {
  const errors: string[] = [];
  
  // Required fields
  if (!productData.title) errors.push('Title is required');
  if (!productData.category) errors.push('Category is required');
  if (!productData.description) errors.push('Description is required');
  if (!productData.rental_price_per_day) errors.push('Rental price is required');
  if (!productData.condition) errors.push('Condition is required');
  
  // Acknowledgements
  if (!productData.seller_acknowledgements?.ownership_accuracy) {
    errors.push('Ownership acknowledgement is required');
  }
  if (!productData.seller_acknowledgements?.condition_hygiene) {
    errors.push('Condition & hygiene acknowledgement is required');
  }
  if (!productData.seller_acknowledgements?.policy_agreement) {
    errors.push('Policy agreement acknowledgement is required');
  }
  
  // Alteration notes
  if (productData.is_alteration_available && !productData.alteration_notes) {
    errors.push('Alteration notes required when alteration is available');
  }
  
  // Sizes for non-jewelry
  if (!isJewelryType(productData.category)) {
    if (!productData.available_sizes || productData.available_sizes.length === 0) {
      errors.push('At least one size is required for non-jewelry products');
    }
  }
  
  // Images
  if (!productData.images || productData.images.length === 0) {
    errors.push('At least one image is required');
  }
  if (productData.images && productData.images.length > 10) {
    errors.push('Maximum 10 images allowed');
  }
  
  // Category validation
  const validCategories = ['Women', 'Men', 'Goddess Wear', 'Jewelry'];
  if (!validCategories.includes(productData.category)) {
    errors.push('Invalid category. Must be one of: Women, Men, Goddess Wear, Jewelry');
  }
  
  // Condition validation
  const validConditions = ['new', 'excellent', 'good'];
  if (!validConditions.includes(productData.condition)) {
    errors.push('Invalid condition. Must be one of: new, excellent, good');
  }
  
  return errors;
};

/**
 * Sanitize and prepare product data for database
 */
export const sanitizeProductData = (productData: ProductData): ProductData => {
  // Auto-set cover image
  if (!productData.cover_image_url && productData.images?.length > 0) {
    productData.cover_image_url = productData.images[0];
  }
  
  // Set acknowledgement timestamp
  if (productData.seller_acknowledgements && !productData.seller_acknowledgements.acknowledged_at) {
    productData.seller_acknowledgements.acknowledged_at = new Date().toISOString();
  }
  
  // For jewelry, clear optional fields if they're empty strings
  if (isJewelryType(productData.category)) {
    if (productData.material === '') productData.material = undefined;
    if (productData.color === '') productData.color = undefined;
    if (productData.weight === '' || productData.weight === '0') productData.weight = undefined;
  }
  
  // Ensure available_sizes is an array
  if (!productData.available_sizes) {
    productData.available_sizes = [];
  }
  
  // Ensure images is an array
  if (!productData.images) {
    productData.images = [];
  }
  
  return productData;
};

/**
 * Format product for API response
 * Ensures backward compatibility and proper field mapping
 */
export const formatProductResponse = (product: Record<string, unknown>): ProductData => {
  return {
    ...product,
    // Ensure new fields have defaults
    cover_image_url: product.cover_image_url || (product.images as string[])?.[0],
    available_sizes: product.available_sizes || [],
    seller_acknowledgements: product.seller_acknowledgements as SellerAcknowledgements || {
      ownership_accuracy: false,
      condition_hygiene: false,
      policy_agreement: false,
    },
    // Map old size field to overall_size for backward compatibility
    overall_size: product.overall_size || (product.size as string),
    // Ensure weight is string
    weight: product.weight?.toString() || '',
  } as ProductData;
};

/**
 * Get fabric/material options for dropdown
 */
export const getFabricOptions = (): string[] => {
  return ['Silk', 'Net', 'Georgette', 'Cotton', 'Mixed', 'Other'];
};

/**
 * Get condition options
 */
export const getConditionOptions = (): string[] => {
  return ['new', 'excellent', 'good'];
};

/**
 * Get category options
 */
export const getCategoryOptions = (): string[] => {
  return ['Women', 'Men', 'Goddess Wear', 'Jewelry'];
};

// Helper function to upload image to Supabase Storage
export async function uploadProductImage(file: Express.Multer.File, productId: string, imageIndex: number): Promise<string> {
  const fileExt = file.originalname.split('.').pop();
  const fileName = `${productId}_${imageIndex}_${Date.now()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { data, error } = await supabaseDB.storage
    .from('product-images')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: publicUrlData } = supabaseDB.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

// Helper function to delete image from Supabase Storage
export async function deleteProductImage(imageUrl: string): Promise<void> {
  const urlParts = imageUrl.split('/');
  const bucketIndex = urlParts.findIndex(part => part === 'product-images');
  if (bucketIndex === -1) return;

  const filePath = urlParts.slice(bucketIndex + 1).join('/');

  const { error } = await supabaseDB.storage
    .from('product-images')
    .remove([filePath]);

  if (error) {
    console.error('Failed to delete image from storage:', error);
  }
}

// Helper function to handle multiple image uploads
export async function uploadMultipleImages(files: Express.Multer.File[], productId: string): Promise<string[]> {
  const uploadPromises = files.map((file, index) =>
    uploadProductImage(file, productId, index)
  );

  return Promise.all(uploadPromises);
}

export async function createProduct(productData: ProductData) {
  console.log('Creating product with data:', productData);
  
  // Sanitize data before inserting
  const sanitizedData = sanitizeProductData(productData);
  
  const { data, error } = await supabaseDB
    .from('products')
    .insert([sanitizedData])
    .select()
    .single();

  console.log('Product creation response:', data, error);

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  return formatProductResponse(data);
}

export async function updateProduct(productId: string, productData: Partial<ProductData>) {
  // Only sanitize if we have a complete product object
  const dataToUpdate = productData.title ? sanitizeProductData(productData as ProductData) : productData;
  
  const { data, error } = await supabaseDB
    .from('products')
    .update({
      ...dataToUpdate,
      updated_at: new Date().toISOString()
    })
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }

  return formatProductResponse(data);
}

export async function deleteProduct(productId: string) {
  const { data: product } = await supabaseDB
    .from('products')
    .select('images')
    .eq('id', productId)
    .single();

  if (product?.images) {
    for (const imageUrl of product.images) {
      await deleteProductImage(imageUrl);
    }
  }

  const { error } = await supabaseDB
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`);
  }
}

export async function getProductById(productId: string) {
  const { data, error } = await supabaseDB
    .from('products')
    .select(`
      *,
      is_multi_piece,
      piece_details,
      is_alteration_available,
      target_gender,
      profiles!products_seller_id_fkey (
        full_name,
        phone_number,
        pickup_address
      )
    `)
    .eq('id', productId)
    .single();

    console.log('Fetched product:', data, error);

  if (error) {
    throw new Error(`Product not found: ${error.message}`);
  }

  return formatProductResponse(data);
}

export async function getSellerProducts(sellerId: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseDB
    .from('products')
    .select(`
      *,
      is_multi_piece,
      piece_details,
      is_alteration_available,
      target_gender
    `, { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch seller products: ${error.message}`);
  }

  return {
    products: (data || []).map(formatProductResponse),
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function searchProducts(
  searchQuery?: string,
  filters: ProductFilters = {},
  page: number = 1,
  limit: number = 10
) {
  const offset = (page - 1) * limit;

  let query = supabaseDB
    .from('products')
    .select(`
      *,
      is_multi_piece,
      piece_details,
      target_gender,
      profiles!products_seller_id_fkey (
        full_name,
        pickup_address
      )
    `, { count: 'exact' })
    .eq('is_visible', true);

  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.subcategory) {
    query = query.eq('subcategory', filters.subcategory);
  }

  if (filters.minPrice) {
    query = query.gte('rental_price_per_day', filters.minPrice);
  }

  if (filters.maxPrice) {
    query = query.lte('rental_price_per_day', filters.maxPrice);
  }

  if (filters.size) {
    // Search in both overall_size (ilike for partial/comma-separated matches) 
    // and available_sizes (contains for array membership)
    // Case insensitive by converting to lowercase
    const sizeLower = filters.size.toLowerCase();
    
    // Use OR to check both columns - overall_size uses ilike, available_sizes uses contains
    query = query.or(`overall_size.ilike.%${filters.size}%,available_sizes.cs.{"${filters.size}"},available_sizes.cs.{"${sizeLower}"},available_sizes.cs.{"${filters.size.toUpperCase()}"}`);
  }

  if (filters.availability) {
    query = query.eq('availability_status', filters.availability);
  } else {
    query = query.eq('availability_status', 'available');
  }

  if (filters.featured) {
    query = query.eq('is_featured', true);
  }

  if (filters.color) {
    query = query.eq('color', filters.color);
  }

  if (filters.material) {
    query = query.eq('material', filters.material);
  }

  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }

  if (filters.occasion_tags && filters.occasion_tags.length > 0) {
    query = query.contains('occasion_tags', filters.occasion_tags);
  }

  if (filters.condition) {
    query = query.eq('condition', filters.condition);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }

  return {
    products: (data || []).map(formatProductResponse),
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function getProductsByCategory(
  category: string,
  page: number = 1,
  limit: number = 10
) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseDB
    .from('products')
    .select(`
      *,
      is_multi_piece,
      piece_details,
      is_alteration_available,
      target_gender,
      profiles!products_seller_id_fkey (
        full_name,
        pickup_address
      )
    `, { count: 'exact' })
    .eq('category', category)
    .eq('availability_status', 'available')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch products by category: ${error.message}`);
  }

  return {
    products: (data || []).map(formatProductResponse),
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function getFeaturedProducts(page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseDB
    .from('products')
    .select(`
      *,
      is_multi_piece,
      piece_details,
      is_alteration_available,
      target_gender,
      profiles!products_seller_id_fkey (
        full_name,
        pickup_address
      )
    `, { count: 'exact' })
    .eq('is_featured', true)
    .eq('availability_status', 'available')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch featured products: ${error.message}`);
  }

  return {
    products: (data || []).map(formatProductResponse),
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function browseProducts(
  category?: string,
  page: number = 1,
  limit: number = 10
) {
  const offset = (page - 1) * limit;

  let query = supabaseDB
    .from('products')
    .select(`
      *,
      is_multi_piece,
      piece_details,
      is_alteration_available,
      target_gender,
      profiles!products_seller_id_fkey (
        full_name,
        pickup_address
      )
    `, { count: 'exact' })
    .eq('availability_status', 'available')
    .eq('is_visible', true);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to browse products: ${error.message}`);
  }

  return {
    products: (data || []).map(formatProductResponse),
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}