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
  is_featured?: boolean;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  availability?: string;
  featured?: boolean;
}

// Helper function to upload image to Supabase Storage
export async function uploadProductImage(file: File, productId: string, imageIndex: number): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}_${imageIndex}_${Date.now()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { data, error } = await supabaseDB.storage
    .from('product-images')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabaseDB.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

// Helper function to delete image from Supabase Storage
export async function deleteProductImage(imageUrl: string): Promise<void> {
  // Extract file path from URL
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
export async function uploadMultipleImages(files: File[], productId: string): Promise<string[]> {
  const uploadPromises = files.map((file, index) => 
    uploadProductImage(file, productId, index)
  );
  
  return Promise.all(uploadPromises);
}

export async function createProduct(productData: ProductData) {
  console.log('Creating product with data:', productData);
  const { data, error } = await supabaseDB
    .from('products')
    .insert([productData])
    .select()
    .single();

  console.log('Product creation response:', data, error);
  
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
  // First, get the product to retrieve image URLs
  const { data: product } = await supabaseDB
    .from('products')
    .select('images')
    .eq('id', productId)
    .single();

  // Delete images from storage
  if (product?.images) {
    for (const imageUrl of product.images) {
      await deleteProductImage(imageUrl);
    }
  }

  // Delete product from database
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