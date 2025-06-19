import supabaseDB from "../../config/connectDB";


export async function addToWishlist(buyerId: string, productId: string) {
  // Check if already in wishlist
  const { data: existing } = await supabaseDB
    .from('favorites')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('product_id', productId)
    .single();

  if (existing) {
    throw new Error('Product already in wishlist');
  }

  const { data, error } = await supabaseDB
    .from('favorites')
    .insert([{
      buyer_id: buyerId,
      product_id: productId
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add to wishlist: ${error.message}`);
  }

  return data;
}

export async function removeFromWishlist(buyerId: string, productId: string) {
  const { error } = await supabaseDB
    .from('favorites')
    .delete()
    .eq('buyer_id', buyerId)
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to remove from wishlist: ${error.message}`);
  }
}

export async function getUserWishlist(buyerId: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;
  
  const { data, error, count } = await supabaseDB
    .from('favorites')
    .select(`
      id,
      created_at,
      products (
        *,
        profiles!products_seller_id_fkey (
          full_name,
          pickup_address
        )
      )
    `, { count: 'exact' })
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch wishlist: ${error.message}`);
  }

  return {
    items: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function checkIfInWishlist(buyerId: string, productId: string): Promise<boolean> {
  const { data, error } = await supabaseDB
    .from('favorites')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('product_id', productId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    throw new Error(`Failed to check wishlist status: ${error.message}`);
  }

  return !!data;
}