import supabaseDB from "../../config/connectDB";

export interface ProductData {
  seller_id: string;
  title: string;
  category: 'costumes' | 'jewelry' | 'formal_wear' | 'accessories';
  description?: string;
  images: string[];
  rental_price_per_day: number;
  security_deposit_percentage: number;
  size?: string;
  availability_status?: 'available' | 'unavailable' | 'booked';
  try_on_available?: boolean;
  try_on_location?: any;
  is_featured?: boolean; // Add featured flag
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  availability?: string;
  featured?: boolean; // Add featured filter
}

export async function createProduct(productData: ProductData) {
  const { data, error } = await supabaseDB
    .from('products')
    .insert([productData])
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }
  
  return data;
}

export async function updateProduct(productId: string, productData: Partial<ProductData>) {
  const { data, error } = await supabaseDB
    .from('products')
    .update({
      ...productData,
      updated_at: new Date().toISOString()
    })
    .eq('id', productId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }
  
  return data;
}

export async function deleteProduct(productId: string) {
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
      profiles!products_seller_id_fkey (
        full_name,
        phone_number,
        pickup_address
      )
    `)
    .eq('id', productId)
    .single();
  
  if (error) {
    throw new Error(`Product not found: ${error.message}`);
  }
  
  return data;
}

export async function getSellerProducts(sellerId: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;
  
  const { data, error, count } = await supabaseDB
    .from('products')
    .select('*', { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    throw new Error(`Failed to fetch seller products: ${error.message}`);
  }
  
  return {
    products: data,
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
      profiles!products_seller_id_fkey (
        full_name,
        pickup_address
      )
    `, { count: 'exact' });

  // Text search
  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  // Apply filters
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  
  if (filters.minPrice) {
    query = query.gte('rental_price_per_day', filters.minPrice);
  }
  
  if (filters.maxPrice) {
    query = query.lte('rental_price_per_day', filters.maxPrice);
  }
  
  if (filters.size) {
    query = query.eq('size', filters.size);
  }
  
  if (filters.availability) {
    query = query.eq('availability_status', filters.availability);
  } else {
    // Default to available products only
    query = query.eq('availability_status', 'available');
  }

  // Featured filter
  if (filters.featured) {
    query = query.eq('is_featured', true);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }

  return {
    products: data,
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
      profiles!products_seller_id_fkey (
        full_name,
        pickup_address
      )
    `, { count: 'exact' })
    .eq('category', category)
    .eq('availability_status', 'available')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch products by category: ${error.message}`);
  }

  return {
    products: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

// New function specifically for featured products
export async function getFeaturedProducts(page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;
  
  const { data, error, count } = await supabaseDB
    .from('products')
    .select(`
      *,
      profiles!products_seller_id_fkey (
        full_name,
        pickup_address
      )
    `, { count: 'exact' })
    .eq('is_featured', true)
    .eq('availability_status', 'available')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch featured products: ${error.message}`);
  }

  return {
    products: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}