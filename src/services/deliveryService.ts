import supabaseDB from '../../config/connectDB';

export async function getAssignedDeliveries(deliveryPartnerId: string) {
  const { data, error } = await supabaseDB
    .from('delivery_assignments')
    .select(`
      id,
      order_id,
      status,
      assigned_at,
      accepted_at,
      completed_at,
      assignment_type,
      notes,
      orders (
        id,
        delivery_status,
        pickup_address,
        delivery_address,
        rental_start_date,
        rental_end_date,
        products (
          title,
          category
        ),
        buyer:profiles!orders_buyer_id_fkey (
          full_name,
          phone_number,
          email
        ),
        seller:profiles!orders_seller_id_fkey (
          full_name,
          phone_number,
          email
        )
      )
    `)
    .eq('delivery_partner_id', deliveryPartnerId)
    .in('status', ['assigned', 'accepted', 'in_progress'])
    .order('assigned_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch assigned deliveries: ${error.message}`);
  }

  return data;
}

export async function updateDeliveryStatus(
  assignmentId: string,
  deliveryPartnerId: string,
  status: 'accepted' | 'in_progress' | 'completed' | 'cancelled'
) {
  const validStatuses = ['accepted', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }

  // Verify the assignment belongs to the delivery partner
  const { data: assignment, error: fetchError } = await supabaseDB
    .from('delivery_assignments')
    .select('delivery_partner_id, order_id')
    .eq('id', assignmentId)
    .single();

  if (fetchError || !assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.delivery_partner_id !== deliveryPartnerId) {
    throw new Error('Unauthorized: Assignment does not belong to this delivery partner');
  }

  const updateData: any = { status };
  if (status === 'accepted') {
    updateData.accepted_at = new Date().toISOString();
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  } else if (status === 'cancelled') {
    updateData.cancelled_at = new Date().toISOString();
  }

  const { data, error } = await supabaseDB
    .from('delivery_assignments')
    .update(updateData)
    .eq('id', assignmentId)
    .select(`
      *,
      orders (
        id,
        delivery_status,
        products (title),
        buyer:profiles!orders_buyer_id_fkey (full_name, email),
        seller:profiles!orders_seller_id_fkey (full_name, email)
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update delivery status: ${error.message}`);
  }

  // Update order status if necessary
  let orderStatus: string | undefined;
  if (status === 'accepted') {
    orderStatus = 'accepted';
  } else if (status === 'in_progress') {
    orderStatus = 'out_for_pickup';
  } else if (status === 'completed') {
    orderStatus = 'delivered';
  } else if (status === 'cancelled') {
    orderStatus = 'pending';
  }

  if (orderStatus) {
    const { error: orderError } = await supabaseDB
      .from('orders')
      .update({ delivery_status: orderStatus })
      .eq('id', assignment.order_id);

    if (orderError) {
      throw new Error(`Failed to update order status: ${orderError.message}`);
    }
  }

  return data;
}

export async function getDeliveryHistory(
  deliveryPartnerId: string,
  statusFilter?: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
) {
  let query = supabaseDB
    .from('delivery_assignments')
    .select(`
      id,
      order_id,
      status,
      assigned_at,
      accepted_at,
      completed_at,
      assignment_type,
      notes,
      orders (
        id,
        delivery_status,
        pickup_address,
        delivery_address,
        rental_start_date,
        rental_end_date,
        products (
          title,
          category
        ),
        buyer:profiles!orders_buyer_id_fkey (
          full_name,
          phone_number,
          email
        ),
        seller:profiles!orders_seller_id_fkey (
          full_name,
          phone_number,
          email
        )
      )
    `)
    .eq('delivery_partner_id', deliveryPartnerId)
    .order('assigned_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch delivery history: ${error.message}`);
  }

  return data;
}

export async function addDeliveryNotes(
  assignmentId: string,
  deliveryPartnerId: string,
  notes: string
) {
  // Verify the assignment belongs to the delivery partner
  const { data: assignment, error: fetchError } = await supabaseDB
    .from('delivery_assignments')
    .select('delivery_partner_id')
    .eq('id', assignmentId)
    .single();

  if (fetchError || !assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.delivery_partner_id !== deliveryPartnerId) {
    throw new Error('Unauthorized: Assignment does not belong to this delivery partner');
  }

  const { data, error } = await supabaseDB
    .from('delivery_assignments')
    .update({ notes })
    .eq('id', assignmentId)
    .select(`
      *,
      orders (
        id,
        delivery_status,
        products (title),
        buyer:profiles!orders_buyer_id_fkey (full_name, email),
        seller:profiles!orders_seller_id_fkey (full_name, email)
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to add delivery notes: ${error.message}`);
  }

  return data;
}