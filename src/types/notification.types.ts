// Notification Types and Interfaces for the Enhanced Notification System

export type NotificationType =
  // Order lifecycle
  | 'order_placed'
  | 'order_accepted'
  | 'order_cancelled'

  // Delivery status
  | 'delivery_assigned'
  | 'out_for_pickup'
  | 'item_picked_up'
  | 'out_for_delivery'
  | 'item_delivered'
  | 'return_initiated'
  | 'item_returned'

  // Payment related
  | 'payment_received'
  | 'payment_failed'
  | 'refund_processed'
  | 'security_deposit_released'
  | 'security_deposit_deducted'

  // Fees and penalties
  | 'late_fee_applied'
  | 'damage_claim_reported'
  | 'damage_claim_approved'
  | 'damage_claim_rejected'

  // Product related
  | 'product_approved'
  | 'product_rejected'
  | 'product_review_received'

  // Cart and wishlist
  | 'cart_item_expiring'
  | 'product_available_again'

  // KYC
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'kyc_documents_required'

  // Promo and referral
  | 'promo_code_available'
  | 'referral_reward_earned'
  | 'referral_signup_complete'

  // Reminders
  | 'rental_ending_soon'
  | 'return_reminder'
  | 'try_on_scheduled'

  // General
  | 'system_announcement'
  | 'custom';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationActionType =
  | 'view_order'
  | 'view_product'
  | 'make_payment'
  | 'upload_documents'
  | 'rate_product'
  | 'contact_support'
  | 'view_profile'
  | 'none';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;

  // Related entities
  order_id?: string;
  product_id?: string;
  payment_id?: string;

  // Additional metadata
  metadata: Record<string, any>;

  // Action button
  action_type?: NotificationActionType;
  action_url?: string;

  // Status tracking
  read: boolean;
  read_at?: string;

  // Priority level
  priority: NotificationPriority;

  // Notification delivery channels
  sent_in_app: boolean;
  sent_email: boolean;
  sent_whatsapp: boolean;

  // Expiry
  expires_at?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;

  // Channel preferences
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;

  // Notification type preferences
  type_preferences: {
    order_updates: boolean;
    payment_updates: boolean;
    delivery_updates: boolean;
    product_updates: boolean;
    promotional: boolean;
    reminders: boolean;
    system_announcements: boolean;
  };

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string; // HH:MM format
  quiet_hours_end?: string; // HH:MM format

  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  title_template: string;
  message_template: string;
  variables: string[];
  default_priority: NotificationPriority;
  default_action_type?: NotificationActionType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationDto {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  order_id?: string;
  product_id?: string;
  payment_id?: string;
  metadata?: Record<string, any>;
  action_type?: NotificationActionType;
  action_url?: string;
  priority?: NotificationPriority;
  expires_at?: string;
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  read?: boolean;
  priority?: NotificationPriority;
  type?: NotificationType;
  order_id?: string;
  product_id?: string;
}

export interface UnreadNotificationCounts {
  user_id: string;
  unread_count: number;
  urgent_count: number;
  high_priority_count: number;
}

export interface SendNotificationOptions {
  order_id?: string;
  product_id?: string;
  payment_id?: string;
  expires_at?: string;
  skip_preferences_check?: boolean;
}

export interface NotificationTemplateVariables {
  [key: string]: string | number;
}