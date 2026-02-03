import supabaseDB from '../../config/connectDB';
import { sendTemplatedEmail } from '../../utils/sendEmail';
import {
  NotificationType,
  NotificationPriority,
  NotificationActionType,
  Notification,
  NotificationPreferences,
  NotificationTemplate,
  CreateNotificationDto,
  SendNotificationOptions,
  NotificationTemplateVariables
} from '../types/notification.types';

// Helper function to get user notification preferences
export async function getUserPreferences(userId: string): Promise<NotificationPreferences> {
  const { data: preferences, error } = await supabaseDB
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !preferences) {
    // Return default preferences if not found
    return {
      id: '',
      user_id: userId,
      email_enabled: true,
      whatsapp_enabled: true,
      push_enabled: true,
      type_preferences: {
        order_updates: true,
        payment_updates: true,
        delivery_updates: true,
        product_updates: true,
        promotional: true,
        reminders: true,
        system_announcements: true,
      },
      quiet_hours_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return preferences as NotificationPreferences;
}

// Helper function to check if notification should be sent based on preferences
export function shouldSendNotification(type: NotificationType, preferences: NotificationPreferences): boolean {
  const typeMapping: Record<NotificationType, keyof NotificationPreferences['type_preferences']> = {
    // Order lifecycle
    order_placed: 'order_updates',
    order_accepted: 'order_updates',
    order_pending_seller_confirmation: 'order_updates',
    order_confirmed: 'order_updates',
    order_rejected_by_seller: 'order_updates',
    order_auto_confirmed: 'order_updates',
    order_cancelled: 'order_updates',

    // Delivery status
    delivery_assigned: 'delivery_updates',
    out_for_pickup: 'delivery_updates',
    item_picked_up: 'delivery_updates',
    out_for_delivery: 'delivery_updates',
    item_delivered: 'delivery_updates',
    return_initiated: 'delivery_updates',
    item_returned: 'delivery_updates',

    // Payment related
    payment_received: 'payment_updates',
    payment_failed: 'payment_updates',
    refund_processed: 'payment_updates',
    security_deposit_released: 'payment_updates',
    security_deposit_deducted: 'payment_updates',

    // Fees and penalties
    late_fee_applied: 'payment_updates',
    damage_claim_reported: 'order_updates',
    damage_claim_approved: 'order_updates',
    damage_claim_rejected: 'order_updates',

    // Product related
    product_approved: 'product_updates',
    product_rejected: 'product_updates',
    product_review_received: 'product_updates',

    // Cart and wishlist
    cart_item_expiring: 'reminders',
    product_available_again: 'product_updates',

    // KYC
    kyc_approved: 'system_announcements',
    kyc_rejected: 'system_announcements',
    kyc_documents_required: 'system_announcements',

    // Promo and referral
    promo_code_available: 'promotional',
    referral_reward_earned: 'promotional',
    referral_signup_complete: 'promotional',

    // Reminders
    rental_ending_soon: 'reminders',
    return_reminder: 'reminders',
    try_on_scheduled: 'reminders',

    // General
    system_announcement: 'system_announcements',
    custom: 'system_announcements',
  };

  const category = typeMapping[type];
  return preferences.type_preferences[category];
}

// Helper function to check if current time is within quiet hours
export function isQuietHours(preferences: NotificationPreferences): boolean {
  if (!preferences.quiet_hours_enabled || !preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = preferences.quiet_hours_start.split(':').map(Number);
  const [endHour, endMin] = preferences.quiet_hours_end.split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  if (startTime <= endTime) {
    // Same day range
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Overnight range
    return currentTime >= startTime || currentTime <= endTime;
  }
}

// New sendNotification function for the updated system
export async function sendNotificationV2(dto: CreateNotificationDto): Promise<Notification> {
  // Get user preferences
  const preferences = await getUserPreferences(dto.user_id);

  // Check if notification should be sent
  if (!shouldSendNotification(dto.type, preferences)) {
    throw new Error(`Notification type ${dto.type} is disabled in user preferences`);
  }

  // Check quiet hours
  if (isQuietHours(preferences)) {
    // For now, we'll still send but mark as not sent via channels during quiet hours
    // In future, could queue for later
  }

  // Insert notification
  const notificationData = {
    user_id: dto.user_id,
    title: dto.title,
    message: dto.message,
    type: dto.type,
    order_id: dto.order_id,
    product_id: dto.product_id,
    payment_id: dto.payment_id,
    metadata: dto.metadata || {},
    action_type: dto.action_type,
    action_url: dto.action_url,
    priority: dto.priority || 'normal',
    expires_at: dto.expires_at,
    sent_in_app: true,
    sent_email: preferences.email_enabled && !isQuietHours(preferences),
    sent_whatsapp: preferences.whatsapp_enabled && !isQuietHours(preferences),
  };

  const { data: notification, error } = await supabaseDB
    .from('notifications')
    .insert(notificationData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  // TODO: Actually send email and whatsapp if enabled
  // For now, just mark as sent

  return notification as Notification;
}

// New function to send notification from template
export async function sendNotificationFromTemplate(
  userId: string,
  type: NotificationType,
  variables: NotificationTemplateVariables,
  options: SendNotificationOptions = {}
): Promise<Notification> {
  // Fetch template
  const { data: template, error: templateError } = await supabaseDB
    .from('notification_templates')
    .select('*')
    .eq('type', type)
    .eq('is_active', true)
    .single();

  if (templateError || !template) {
    throw new Error(`Template not found for type ${type}`);
  }

  // Replace variables in title and message
  let title = template.title_template;
  let message = template.message_template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    title = title.replace(new RegExp(placeholder, 'g'), String(value));
    message = message.replace(new RegExp(placeholder, 'g'), String(value));
  }

  // Create notification DTO
  const dto: CreateNotificationDto = {
    user_id: userId,
    type,
    title,
    message,
    order_id: options.order_id,
    product_id: options.product_id,
    payment_id: options.payment_id,
    priority: template.default_priority,
    action_type: template.default_action_type,
    expires_at: options.expires_at,
  };

  return await sendNotificationV2(dto);
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  whatsapp_notifications: boolean;
  email_notifications: boolean;
  role: 'seller' | 'buyer' | 'admin' | 'delivery_partner';
}

interface NotificationProps {
  userId: string;
  eventType: string;
  placeholders?: Record<string, string>;
  isTesting?: boolean;
}

interface LegacyNotificationTemplate {
  inApp: string;
  whatsapp?: string;
  email?: {
    subject: string;
    body: string;
  };
}

const notificationTemplates: Record<string, Record<string, LegacyNotificationTemplate>> = {
  seller: {
    account_created: {
      inApp: 'Welcome to Yafora! Your seller account is live.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your seller account has been successfully created. We\'re thrilled to welcome you aboard! Get ready to turn your collections into profits. 💫 Let the elegance flow — Team Yafora',
      email: {
        subject: 'Welcome to Yafora – Your Seller Journey Begins',
        body: 'Hello {{full_name}},\n\nCongratulations! Your Yafora Seller account is now active. We are honored to have your elegance on our platform. Begin listing your jewelry and costumes and let the world experience your style.\n\nIf you need support, we\'re just one click away.\n\nWith grace,\nTeam Yafora'
      }
    },
    kyc_approved: {
      inApp: 'KYC Verified. You\'re now ready to list products!',
      whatsapp: 'Yafora: Congrats {{full_name}}! Your KYC is verified. Start listing your products now and shine! ✨ – Team Yafora',
      email: {
        subject: 'KYC Verified – Start Listing Now',
        body: 'Hello {{full_name}},\n\nYour KYC verification is successful! You\'re now eligible to list your costume and jewelry items for rent on Yafora.\n\nClick below to start adding your products:\n🔗 List a Product\n\nHappy Renting!\nBest,\nYafora Team'
      }
    },
    product_listed: {
      inApp: 'Your product {{product_name}} has been listed successfully.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your product listing {{product_name}} is now live. Well done! Wishing you great rentals ahead 🌟 Thank you – Team Yafora',
      email: {
        subject: 'Your Product {{product_name}} is Now Live on Yafora',
        body: 'Dear {{full_name}},\n\nYour product, {{product_name}}, is now live and available for rental. Thank you for enriching our collection.\n\nLet us know if you need help attracting more visibility.\n\nElegant regards,\nTeam Yafora'
      }
    },
    order_accepted: {
      inApp: 'You have a new rental request for {{product_name}}.',
      whatsapp: 'Yafora: Hello {{full_name}}, A buyer has requested to rent your product {{product_name}}. Please respond promptly to ensure smooth coordination. Thank you – Team Yafora',
      email: {
        subject: 'You\'ve Got a Booking!',
        body: 'Hello {{full_name}},\n\nGreat news! Your product, "{{product_name}}", has been rented by a customer. Please prepare it for dispatch.\n\n📅 Rental Period: {{rental_start_date}} to {{rental_end_date}}\n📍 Pickup/Delivery Method: {{delivery_method}}\n💰 Total Amount: ₹{{total_amount}}\n👤 Customer: {{customer_name}}\n📞 Customer Contact: {{customer_phone}}\n📍 Delivery Address: {{delivery_address}}\n\n📋 Next Steps:\n• Prepare the item for pickup/delivery\n• Ensure the item is in excellent condition\n• Coordinate with the delivery partner if applicable\n• Contact us if you need any assistance\n\nKeep up the great listings!\n\nCheers,\nThe Yafora Team'
      }
    },
    product_picked_up: {
      inApp: 'Your product {{product_name}} has been picked up by our delivery partner.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your product {{product_name}} has been successfully picked up by our delivery partner {{partner_name}}. It\'s now on its way to the customer. Thank you for your cooperation! – Team Yafora',
      email: {
        subject: 'Product Picked Up - {{product_name}}',
        body: 'Dear {{full_name}},\n\nYour product "{{product_name}}" has been successfully picked up by our delivery partner {{partner_name}}.\n\n📦 Order Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Customer: {{customer_name}}\n- Customer Phone: {{customer_phone}}\n- Pickup Time: {{pickup_time}}\n- Delivery Partner: {{partner_name}}\n- Partner Phone: {{partner_phone}}\n- Delivery Address: {{delivery_address}}\n\nThe item is now on its way to the customer. You can track the delivery status in your dashboard.\n\nThank you for your prompt cooperation!\n\nBest regards,\nTeam Yafora'
      }
    },
    product_delivered: {
      inApp: 'Your product {{product_name}} has been delivered to the customer.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your product {{product_name}} has been successfully delivered to {{customer_name}}. The rental period has begun. Thank you! – Team Yafora',
      email: {
        subject: 'Product Delivered Successfully - {{product_name}}',
        body: 'Dear {{full_name}},\n\nGreat news! Your product "{{product_name}}" has been successfully delivered to the customer.\n\n📦 Delivery Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Customer: {{customer_name}}\n- Customer Phone: {{customer_phone}}\n- Delivered At: {{delivery_time}}\n- Delivered By: {{partner_name}}\n- Partner Phone: {{partner_phone}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n- Expected Return: {{return_date}}\n\nThe rental period has officially begun. You can expect the product to be returned after the rental period ends.\n\nThank you for being a valued partner!\n\nBest regards,\nTeam Yafora'
      }
    },
    product_returned: {
      inApp: 'Your product {{product_name}} has been returned successfully.',
      email: {
        subject: 'Return Verified – Payment on the Way',
        body: 'Hi {{full_name}},\n\nThe returned product for Order #{{order_id}} has been successfully verified.\n\n💰 Your payout of ₹{{payout_amount}} will be processed and credited to your account within 2 working days.\n\n📋 Order Summary:\n- Product: {{product_name}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n- Customer: {{customer_name}}\n- Return Date: {{actual_return_date}}\n\nThanks for being a valued partner.\n\nRegards,\nTeam Yafora'
      }
    },
    late_return: {
      inApp: 'Buyer has delayed return of {{product_name}}. Late fee applicable.',
      whatsapp: 'Yafora: Hello {{full_name}}, Please be informed that {{customer_name}} has not returned the item {{product_name}} on time. A late fee is applicable as per policy. We\'ll keep you updated. Stay assured – Team Yafora'
    },
    damage_reported: {
      inApp: 'A damage claim has been raised for {{product_name}}. Admin review in progress.'
    },
    security_deposit_refunded: {
      inApp: 'Security deposit refunded to buyer.',
      email: {
        subject: 'Buyer Refund Processed for {{product_name}}',
        body: 'Dear {{full_name}},\n\nThe security deposit collected for {{product_name}} has been refunded to the buyer. No damage or late issues were found.\n\n📋 Refund Details:\n- Order ID: #{{order_id}}\n- Customer: {{customer_name}}\n- Refund Amount: ₹{{refund_amount}}\n- Product: {{product_name}}\n\nThank you for your service.\nTeam Yafora'
      }
    },
    offer_activated: {
      inApp: 'Your product {{product_name}} is now under an offer. Visibility boosted.'
    },
    review_received: {
      inApp: 'You received a review for {{product_name}}. Check it now!'
    },
    payout_sent: {
      inApp: 'Payout of ₹{{payout_amount}} for {{product_name}} has been credited to your account.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental earnings of ₹{{payout_amount}} for {{product_name}} have been credited. Keep sharing elegance, keep earning! Thank you – Team Yafora'
    }
  },
  buyer: {
    account_created: {
      inApp: 'Welcome to Yafora! Your buyer account is live.',
      email: {
        subject: 'Welcome to the World of Affordable Luxury – Yafora',
        body: 'Hello {{full_name}},\n\nThank you for signing up with Yafora. Explore elegant costume and jewelry rentals tailored just for you.\n\nStart browsing and reserve your style today.\n\nWith love,\nTeam Yafora'
      }
    },
    kyc_approved: {
      inApp: 'KYC Verified. You\'re now ready to rent!',
      whatsapp: 'Yafora: Congrats {{full_name}}! Your KYC is verified. Explore and rent elegant costumes and jewelry now! ✨ – Team Yafora',
      email: {
        subject: 'KYC Verified – Start Renting Now',
        body: 'Hello {{full_name}},\n\nYour KYC verification is complete! You\'re now ready to explore and rent stunning costumes and jewelry on Yafora.\n\nStart browsing:\n🔗 Explore Now\n\nShine on!\nBest,\nYafora Team'
      }
    },
    order_placed: {
      inApp: 'Your rental for {{product_name}} is confirmed.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental for {{product_name}} is confirmed. Kindly ensure pickup/delivery readiness. Shine on – Team Yafora ✨',
      email: {
        subject: 'Your Rental is Confirmed!',
        body: 'Hi {{full_name}},\n\nYour rental for "{{product_name}}" has been confirmed!\n\n📅 Rental Period: {{rental_start_date}} to {{rental_end_date}}\n📍 Delivery Address: {{delivery_address}}\n💰 Total Amount: ₹{{total_amount}}\n🔒 Security Deposit: ₹{{security_deposit}}\n\n📋 Important Information:\n• Please ensure someone is available at the delivery address\n• Keep the item in its original condition for return\n• Contact us immediately if you have any concerns\n\nWe hope you shine in your special moment.\n\nWith love,\nYafora Team'
      }
    },
    product_out_for_delivery: {
      inApp: 'Your rental item {{product_name}} is out for delivery.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental item {{product_name}} is now out for delivery! Our delivery partner {{partner_name}} will contact you shortly. Please be available at the delivery address. – Team Yafora',
      email: {
        subject: 'Your Rental is Out for Delivery - {{product_name}}',
        body: 'Hi {{full_name}},\n\nGreat news! Your rental item "{{product_name}}" is now out for delivery.\n\n🚚 Delivery Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Delivery Partner: {{partner_name}}\n- Partner Contact: {{partner_phone}}\n- Expected Delivery: {{expected_delivery_time}}\n- Delivery Address: {{delivery_address}}\n- Seller: {{seller_name}}\n- Seller Contact: {{seller_phone}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n- Total Amount Paid: ₹{{total_amount}}\n\n📋 What to Expect:\n• Our delivery partner will contact you before arrival\n• Please have ID proof ready for verification\n• Inspect the item upon delivery and report any issues immediately\n• Sign the delivery receipt once satisfied\n\nPlease ensure someone is available at the delivery address. Our delivery partner will contact you before arrival.\n\nGet ready to shine!\n\nBest regards,\nYafora Team'
      }
    },
    product_delivered: {
      inApp: 'Your rental item {{product_name}} has been delivered successfully!',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental item {{product_name}} has been delivered successfully! Enjoy your special moments. Please remember to return it by {{return_date}}. Shine bright! ✨ – Team Yafora',
      email: {
        subject: 'Delivery Confirmed - Enjoy Your Rental!',
        body: 'Hi {{full_name}},\n\nYour rental item "{{product_name}}" has been successfully delivered!\n\n✨ Rental Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Seller: {{seller_name}}\n- Seller Contact: {{seller_phone}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n- Return Date: {{return_date}}\n- Delivered By: {{partner_name}}\n- Partner Contact: {{partner_phone}}\n- Delivery Address: {{delivery_address}}\n- Total Amount Paid: ₹{{total_amount}}\n\n📋 Important Reminders:\n• Please take good care of the item during your rental period\n• Return the item in the same condition you received it\n• Late returns will incur additional charges (₹{{late_fee_per_day}} per day)\n• Contact us immediately if you notice any issues\n• Return instructions will be sent closer to the return date\n\nEnjoy your special moments and shine bright!\n\nWith love,\nYafora Team'
      }
    },
    product_ready: {
      inApp: 'Your item {{product_name}} is ready for pickup/delivery.'
    },
    return_reminder: {
      inApp: 'Reminder: Return {{product_name}} by {{return_date}} to avoid late fees.',
      whatsapp: 'Yafora: Hello {{full_name}}, Gentle reminder to return {{product_name}} by {{return_date}} to avoid late fees. Thank you for your cooperation! – Team Yafora',
      email: {
        subject: 'Return Reminder - {{product_name}}',
        body: 'Hi {{full_name}},\n\nThis is a friendly reminder that your rental period for "{{product_name}}" is ending soon.\n\n📅 Return Date: {{return_date}}\n📍 Return Address: {{pickup_address}}\n👤 Seller: {{seller_name}}\n📞 Seller Contact: {{seller_phone}}\n💰 Late Fee (if delayed): ₹{{late_fee_per_day}} per day\n\nPlease ensure the item is returned on time to avoid any late fees.\n\nThank you!\nYafora Team'
      }
    },
    return_received: {
      inApp: 'Thank you for returning {{product_name}}!'
    },
    late_fee_applied: {
      inApp: 'A late fee of ₹{{late_fee_amount}} has been added for {{product_name}}.',
      whatsapp: 'Yafora: Hello {{full_name}}, This is a gentle reminder that your return for {{product_name}} was delayed. As per policy, a late fee of ₹{{late_fee_amount}} is applicable. We understand life happens, and we appreciate your cooperation. Thank you – Team Yafora'
    },
    damage_claim: {
      inApp: 'Seller has raised a damage claim for {{product_name}}. Review in progress.'
    },
    refund_processed: {
      inApp: 'Your security deposit has been refunded.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your security deposit for {{product_name}} has been refunded. Thank you for taking good care of the item. Team Yafora'
    },
    offer_received: {
      inApp: 'You have unlocked an offer/referral reward! Check your dashboard.'
    },
    review_request: {
      inApp: 'Tell us about your experience with {{product_name}}. Leave a review!'
    }
  },
  admin: {
    new_user_registered: {
      inApp: 'New {{role}} {{full_name}} has registered. KYC pending.'
    },
    kyc_approved: {
      inApp: 'KYC for {{full_name}} has been approved.',
      email: {
        subject: '{{full_name}}\'s KYC Verified',
        body: 'Hello Admin,\n\nThe KYC documents for {{full_name}} (Role: {{role}}) have been verified and approved.\n\nAccount Status: Active ✅\n\nThis user can now access platform features.\n\nThanks,\nYafora System Notification'
      }
    },
    kyc_rejected: {
      inApp: 'KYC for {{full_name}} has been rejected.'
    },
    product_listed: {
      inApp: '{{seller_name}} listed {{product_name}}. Pending moderation.'
    },
    rental_order_placed: {
      inApp: 'Rental order placed: {{product_name}} by {{customer_name}}.'
    },
    product_picked_up: {
      inApp: 'Product {{product_name}} picked up by delivery partner {{partner_name}} for Order #{{order_id}}.',
      email: {
        subject: 'Pickup Completed - Order #{{order_id}}',
        body: 'Hello Admin,\n\nThe pickup has been successfully completed for the following order:\n\n📦 Order Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Seller: {{seller_name}} ({{seller_phone}})\n- Buyer: {{customer_name}} ({{customer_phone}})\n- Delivery Partner: {{partner_name}} ({{partner_phone}})\n- Pickup Time: {{pickup_time}}\n- Delivery Address: {{delivery_address}}\n\nThe item is now in transit to the customer. Next status expected: Delivery completion.\n\nSystem Update,\nYafora Operations'
      }
    },
    product_delivered: {
      inApp: 'Product {{product_name}} delivered to {{customer_name}} for Order #{{order_id}}.',
      email: {
        subject: 'Delivery Completed - Order #{{order_id}}',
        body: 'Hello Admin,\n\nThe delivery has been successfully completed for the following order:\n\n📦 Delivery Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Seller: {{seller_name}} ({{seller_phone}})\n- Customer: {{customer_name}} ({{customer_phone}})\n- Delivery Partner: {{partner_name}} ({{partner_phone}})\n- Delivery Time: {{delivery_time}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n- Expected Return: {{return_date}}\n- Total Amount: ₹{{total_amount}}\n- Security Deposit: ₹{{security_deposit}}\n\nThe rental period has officially begun. The system will automatically send return reminders as the return date approaches.\n\nSystem Update,\nYafora Operations'
      }
    },
    product_returned_damaged: {
      inApp: 'Damage claim raised for {{product_name}} – Review required.',
      email: {
        subject: 'Alert: Rental Order #{{order_id}} Flagged',
        body: 'Hello Admin,\n\nThe rental order #{{order_id}} has been marked as Late/Damaged by the return team.\n\nPlease initiate further action such as late fees, damage charges, or dispute resolution.\n\n🚨 Immediate attention required.\n\nSystem Notification\nYafora Ops Team'
      }
    },
    late_return: {
      inApp: 'Late return for {{product_name}} by {{customer_name}}. Apply penalty.',
      email: {
        subject: 'Alert: Rental Order #{{order_id}} Flagged',
        body: 'Hello Admin,\n\nThe rental order #{{order_id}} has been marked as Late/Damaged by the return team.\n\nPlease initiate further action such as late fees, damage charges, or dispute resolution.\n\n🚨 Immediate attention required.\n\nSystem Notification\nYafora Ops Team'
      }
    },
    refund_payout_released: {
      inApp: 'Refund of ₹{{refund_amount}} sent to {{customer_name}}. Payout to {{seller_name}} approved.'
    },
    delivery_partner_assigned: {
      inApp: 'Order #{{order_id}} has been assigned to delivery partner {{partner_name}}.',
      email: {
        subject: 'Delivery Partner Assigned - Order #{{order_id}}',
        body: 'Hello Admin,\n\nOrder #{{order_id}} for {{product_name}} has been assigned to delivery partner {{partner_name}}.\n\n📦 Order Details:\n- Product: {{product_name}}\n- Buyer: {{customer_name}} ({{customer_phone}})\n- Seller: {{seller_name}} ({{seller_phone}})\n- Partner: {{partner_name}} ({{partner_phone}})\n- Pickup Address: {{pickup_address}}\n- Delivery Address: {{delivery_address}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n\nThe delivery partner has been notified and will begin the pickup/delivery process.\n\nBest regards,\nYafora System'
      }
    },
    delivery_status_updated: {
      inApp: 'Delivery status updated for Order #{{order_id}}: {{status}}',
      email: {
        subject: 'Delivery Status Update - Order #{{order_id}}',
        body: 'Hello Admin,\n\nThe delivery status for Order #{{order_id}} has been updated.\n\n📋 Status Update:\n- Order ID: {{order_id}}\n- Product: {{product_name}}\n- New Status: {{status}}\n- Partner: {{partner_name}} ({{partner_phone}})\n- Timestamp: {{updated_at}}\n\nPlease monitor the progress as needed.\n\nBest regards,\nYafora System'
      }
    }
  },
  delivery_partner: {
    account_created: {
      inApp: 'Welcome to Yafora! Your delivery partner account is active.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your delivery partner account has been successfully created. Welcome to the Yafora delivery team! 🚚 – Team Yafora',
      email: {
        subject: 'Welcome to Yafora Delivery Team',
        body: 'Hello {{full_name}},\n\nWelcome to the Yafora delivery partner program! Your account is now active and you can start accepting delivery assignments.\n\nWe look forward to working with you to provide excellent delivery service to our customers.\n\nBest regards,\nYafora Operations Team'
      }
    },
    kyc_approved: {
      inApp: 'KYC Verified. You can now accept delivery assignments!',
      whatsapp: 'Yafora: Congrats {{full_name}}! Your KYC is verified. You can now start accepting delivery assignments! 🚚✨ – Team Yafora',
      email: {
        subject: 'KYC Verified – Ready for Deliveries',
        body: 'Hello {{full_name}},\n\nYour KYC verification is complete! You are now eligible to accept delivery assignments on the Yafora platform.\n\nLog in to your dashboard to view available delivery requests.\n\nHappy delivering!\nYafora Operations Team'
      }
    },
    order_assigned: {
      inApp: 'New delivery assigned: Order #{{order_id}} for {{product_name}}',
      whatsapp: 'Yafora: Hello {{full_name}}, You have been assigned a new delivery task for Order #{{order_id}}. Please check your dashboard for details. Thank you – Team Yafora 🚚',
      email: {
        subject: 'New Delivery Assignment - Order #{{order_id}}',
        body: 'Hello {{full_name}},\n\nYou have been assigned a new delivery task:\n\n📦 Order Details:\n- Order ID: {{order_id}}\n- Product: {{product_name}}\n- Pickup Address: {{pickup_address}}\n- Delivery Address: {{delivery_address}}\n- Buyer: {{customer_name}}\n- Buyer Contact: {{customer_phone}}\n- Seller: {{seller_name}}\n- Seller Contact: {{seller_phone}}\n- Scheduled Date: {{scheduled_date}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n\nPlease confirm acceptance and coordinate with both parties for smooth pickup and delivery.\n\nBest regards,\nYafora Operations Team'
      }
    },
    delivery_status_updated: {
      inApp: 'Status updated for Order #{{order_id}}: {{status}}',
      whatsapp: 'Yafora: Hello {{full_name}}, The status for Order #{{order_id}} has been updated to {{status}}. Thank you for the update! – Team Yafora',
      email: {
        subject: 'Delivery Status Confirmed - Order #{{order_id}}',
        body: 'Hello {{full_name}},\n\nThank you for updating the delivery status for Order #{{order_id}}.\n\n📋 Status Update:\n- Order ID: {{order_id}}\n- Product: {{product_name}}\n- Status: {{status}}\n- Updated At: {{updated_at}}\n- Customer: {{customer_name}}\n- Seller: {{seller_name}}\n\nIf this is a delivery completion, great job! If you encountered any issues, please contact support.\n\nBest regards,\nYafora Operations Team'
      }
    },
    payment_processed: {
      inApp: 'Payment of ₹{{payment_amount}} for deliveries has been processed.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your delivery payment of ₹{{payment_amount}} has been processed and will be credited soon. Thank you for your service! 🚚💰 – Team Yafora'
    }
  }
};

// Helper function to fetch complete order data
async function fetchCompleteOrderData(orderId: string) {
  const { data: order, error: orderError } = await supabaseDB
    .from('orders')
    .select(`
      id,
      total_amount,
      security_deposit,
      rental_start_date,
      rental_end_date,
      expected_return_date,
      actual_return_date,
      pickup_address,
      delivery_address,
      late_fee,
      damage_fee,
      security_deposit_refunded_amount,
      delivery_status,
      order_status,
      buyer_id,
      seller_id,
      product_id,
      delivery_partner_id
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to fetch order: ${orderError?.message || 'Order not found'}`);
  }

  return order;
}

// Helper function to fetch user profile with all necessary fields
async function fetchUserProfile(userId: string) {
  const { data: profile, error: profileError } = await supabaseDB
    .from('profiles')
    .select('id, full_name, email, phone_number, role')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to fetch profile: ${profileError?.message || 'Profile not found'}`);
  }

  return profile;
}

// Helper function to fetch product details
async function fetchProductDetails(productId: string) {
  const { data: product, error: productError } = await supabaseDB
    .from('products')
    .select('id, title, category, rental_price_per_day, security_deposit_percentage')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    throw new Error(`Failed to fetch product: ${productError?.message || 'Product not found'}`);
  }

  return product;
}

// Helper function to format address
function formatAddress(address: any): string {
  if (!address) return 'Address not provided';
  
  if (typeof address === 'string') return address;
  
  if (typeof address === 'object') {
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    return parts.join(', ') || 'Address not properly formatted';
  }
  
  return 'Address not available';
}

// Helper function to format date
function formatDate(dateString: string): string {
  if (!dateString) return 'Date not available';
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

function replacePlaceholders(template: string, placeholders: Record<string, string> = {}): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

function getEmailTemplateType(eventType: string, role: string): 'kyc' | 'product' | 'rental' | 'admin' | 'delivery' {
  if (role === 'admin') return 'admin';
  if (role === 'delivery_partner') return 'delivery';
  if (eventType.includes('kyc')) return 'kyc';
  if (eventType.includes('rental') || eventType.includes('confirmed') || eventType.includes('booked') || eventType.includes('delivered') || eventType.includes('picked_up') || eventType.includes('out_for_delivery')) return 'rental';
  return 'product';
}

export async function sendNotification({ userId, eventType, placeholders = {}, isTesting = false }: NotificationProps): Promise<{ message: string }> {
  console.log(`🔔 Attempting to send notification: userId=${userId}, eventType=${eventType}, isTesting=${isTesting}`);

  // Fetch user profile
  const { data: profile, error: profileError } = await supabaseDB
    .from('profiles')
    .select('id, full_name, email, phone_number, whatsapp_notifications, email_notifications, role')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error(`❌ Failed to fetch profile for user ${userId}:`, profileError?.message);
    throw new Error(`Failed to fetch profile: ${profileError?.message || 'Profile not found'}`);
  }

  const { full_name, email, phone_number, whatsapp_notifications, email_notifications, role } = profile as Profile;
  console.log(`👤 User found: ${full_name} (${email}) - Role: ${role}, Email notifications: ${email_notifications}`);

  // Enhanced placeholder building with complete data fetching
  let updatedPlaceholders: Record<string, string> = { ...placeholders, full_name };

  // If order_id is provided, fetch complete order data and related profiles
  if (placeholders.order_id) {
    try {
      const order = await fetchCompleteOrderData(placeholders.order_id);

      // Fetch buyer, seller, and product details
      const [buyer, seller, product] = await Promise.all([
        fetchUserProfile(order.buyer_id),
        fetchUserProfile(order.seller_id),
        fetchProductDetails(order.product_id)
      ]);

      // Fetch delivery partner if assigned
      let deliveryPartner = null;
      if (order.delivery_partner_id) {
        deliveryPartner = await fetchUserProfile(order.delivery_partner_id);
      }

      // Build comprehensive placeholders
      updatedPlaceholders = {
        ...updatedPlaceholders,
        order_id: order.id,
        product_name: product.title,
        product_category: product.category,
        rental_price_per_day: product.rental_price_per_day.toString(),

        // Buyer details
        customer_name: buyer.full_name || 'Customer',
        customer_phone: buyer.phone_number || 'Not provided',
        buyer_name: buyer.full_name || 'Buyer',
        buyer_phone: buyer.phone_number || 'Not provided',

        // Seller details
        seller_name: seller.full_name || 'Seller',
        seller_phone: seller.phone_number || 'Not provided',

        // Delivery partner details
        partner_name: deliveryPartner?.full_name || 'Partner not assigned',
        partner_phone: deliveryPartner?.phone_number || 'Not available',

        // Order details
        total_amount: order.total_amount.toString(),
        security_deposit: order.security_deposit.toString(),
        rental_start_date: formatDate(order.rental_start_date),
        rental_end_date: formatDate(order.rental_end_date),
        return_date: formatDate(order.expected_return_date),
        expected_return_date: formatDate(order.expected_return_date),
        actual_return_date: order.actual_return_date ? formatDate(order.actual_return_date) : 'Not returned yet',

        // Address details
        pickup_address: formatAddress(order.pickup_address),
        delivery_address: formatAddress(order.delivery_address),

        // Fees and amounts
        late_fee: order.late_fee?.toString() || '0',
        late_fee_amount: order.late_fee?.toString() || '0',
        damage_fee: order.damage_fee?.toString() || '0',
        refund_amount: order.security_deposit_refunded_amount?.toString() || '0',

        // Calculate payout amount (total_amount - platform_commission if applicable)
        payout_amount: (order.total_amount * 0.85).toString(), // Assuming 15% platform commission

        // Status and timing
        delivery_status: order.delivery_status,
        order_status: order.order_status,
        pickup_time: new Date().toLocaleString('en-IN'),
        delivery_time: new Date().toLocaleString('en-IN'),
        expected_delivery_time: 'within 2-4 hours',
        updated_at: new Date().toLocaleString('en-IN'),

        // Additional details
        delivery_method: 'Door-to-door delivery',
        late_fee_per_day: '50' // This should be configurable
      };
    } catch (error) {
      console.error(`❌ Failed to fetch order data for order_id ${placeholders.order_id}:`, error);
    }
  }

  // If product_id is provided without order_id, fetch basic product details
  if (placeholders.product_id && !placeholders.order_id) {
    try {
      const product = await fetchProductDetails(placeholders.product_id);
      updatedPlaceholders.product_name = product.title;
      updatedPlaceholders.product_category = product.category;
      updatedPlaceholders.rental_price_per_day = product.rental_price_per_day.toString();
    } catch (error) {
      console.error(`❌ Failed to fetch product details for product_id ${placeholders.product_id}:`, error);
    }
  }

  // If specific user IDs are provided, fetch their details
  if (placeholders.seller_id && !updatedPlaceholders.seller_name) {
    try {
      const seller = await fetchUserProfile(placeholders.seller_id);
      updatedPlaceholders.seller_name = seller.full_name || 'Seller';
      updatedPlaceholders.seller_phone = seller.phone_number || 'Not provided';
    } catch (error) {
      console.error(`❌ Failed to fetch seller details:`, error);
    }
  }

  if (placeholders.buyer_id && !updatedPlaceholders.customer_name) {
    try {
      const buyer = await fetchUserProfile(placeholders.buyer_id);
      updatedPlaceholders.customer_name = buyer.full_name || 'Customer';
      updatedPlaceholders.customer_phone = buyer.phone_number || 'Not provided';
      updatedPlaceholders.buyer_name = buyer.full_name || 'Buyer';
      updatedPlaceholders.buyer_phone = buyer.phone_number || 'Not provided';
    } catch (error) {
      console.error(`❌ Failed to fetch buyer details:`, error);
    }
  }

  if (placeholders.partner_id && !updatedPlaceholders.partner_name) {
    try {
      const partner = await fetchUserProfile(placeholders.partner_id);
      updatedPlaceholders.partner_name = partner.full_name || 'Delivery Partner';
      updatedPlaceholders.partner_phone = partner.phone_number || 'Not available';
    } catch (error) {
      console.error(`❌ Failed to fetch partner details:`, error);
    }
  }

  // Get notification template
  const templates = notificationTemplates[role]?.[eventType];
  if (!templates) {
    console.error(`❌ No template found for role ${role} and event ${eventType}`);
    throw new Error(`No template found for role ${role} and event ${eventType}`);
  }

  // Prepare messages with placeholders
  const inAppMessage = replacePlaceholders(templates.inApp, updatedPlaceholders);
  const whatsappMessage = templates.whatsapp ? replacePlaceholders(templates.whatsapp, updatedPlaceholders) : null;
  const emailMessage = templates.email
    ? {
        subject: replacePlaceholders(templates.email.subject, updatedPlaceholders),
        body: replacePlaceholders(templates.email.body, updatedPlaceholders)
      }
    : null;

  console.log(`📋 Templates prepared. Email template exists: ${!!emailMessage}, User wants emails: ${email_notifications}, Testing mode: ${isTesting}`);

  // Insert In-App notification
  const { error: notificationError } = await supabaseDB
    .from('notifications')
    .insert({
      user_id: userId,
      type: eventType,
      title: inAppMessage,
      message: inAppMessage,
      priority: 'normal',
      sent_in_app: true,
      sent_email: email_notifications,
      sent_whatsapp: whatsapp_notifications,
      read: false
    });

  if (notificationError) {
    console.error(`❌ Failed to create in-app notification:`, notificationError.message);
    throw new Error(`Failed to create in-app notification: ${notificationError.message}`);
  }

  console.log(`✅ In-app notification created successfully`);

  // Send Email notification if enabled
  if (email_notifications && email && emailMessage && !isTesting) {
    try {
      console.log(`📧 Attempting to send email to ${email} with subject: "${emailMessage.subject}"`);

      const templateType = getEmailTemplateType(eventType, role);
      await sendTemplatedEmail(email, emailMessage.subject, emailMessage.body, templateType);

      console.log(`✅ Email sent successfully to ${email} for event: ${eventType}`);
    } catch (err) {
      console.error(`❌ Failed to send email notification to ${email}:`, err);
    }
  } else {
    const reasons = [];
    if (!email_notifications) reasons.push('email notifications disabled');
    if (!email) reasons.push('no email address');
    if (!emailMessage) reasons.push('no email template');
    if (isTesting) reasons.push('testing mode');
    console.log(`⚠️ Skipping email notification. Reasons: ${reasons.join(', ')}`);
  }

  // Handle Admin notifications for relevant events
  const adminNotificationEvents = [
    'kyc_approved', 'kyc_rejected', 'new_user_registered', 'product_listed',
    'rental_order_placed', 'product_returned_damaged', 'late_return', 'refund_payout_released',
    'delivery_partner_assigned', 'delivery_status_updated', 'product_picked_up', 'product_delivered'
  ];

  if (adminNotificationEvents.includes(eventType)) {
    console.log(`👑 Event ${eventType} requires admin notification`);

    const { data: admins, error: adminError } = await supabaseDB
      .from('profiles')
      .select('id, email, email_notifications, full_name')
      .eq('role', 'admin');

    if (adminError) {
      console.error(`❌ Failed to fetch admins:`, adminError.message);
    } else {
      console.log(`👑 Found ${admins.length} admin(s) to notify`);

      for (const admin of admins) {
        const adminTemplate = notificationTemplates.admin[eventType];
        if (!adminTemplate) continue;

        const adminMessage = replacePlaceholders(adminTemplate.inApp, updatedPlaceholders);

        const { error: adminNotificationError } = await supabaseDB
          .from('notifications')
          .insert({
            user_id: admin.id,
            type: eventType,
            title: adminMessage,
            message: adminMessage,
            priority: 'normal',
            sent_in_app: true,
            sent_email: admin.email_notifications,
            sent_whatsapp: false,
            read: false
          });

        if (adminNotificationError) {
          console.error(`❌ Failed to create admin notification:`, adminNotificationError.message);
        } else {
          console.log(`✅ Admin in-app notification created for ${admin.full_name}`);
        }

        if (admin.email_notifications && admin.email && adminTemplate.email && !isTesting) {
          try {
            console.log(`📧 Sending admin email to ${admin.email}`);

            await sendTemplatedEmail(
              admin.email,
              replacePlaceholders(adminTemplate.email.subject, updatedPlaceholders),
              replacePlaceholders(adminTemplate.email.body, updatedPlaceholders),
              'admin'
            );

            console.log(`✅ Admin email sent successfully to ${admin.email} for event: ${eventType}`);
          } catch (err) {
            console.error(`❌ Failed to send admin email to ${admin.email}:`, err);
          }
        } else {
          console.log(`⚠️ Skipping admin email for ${admin.full_name}`);
        }
      }
    }
  }

  return { message: 'Notifications sent successfully' };
}

export async function notifyDeliveryPartnerAssignment(
  orderId: string,
  partnerId: string
): Promise<{ message: string }> {
  console.log(`🚚 Sending delivery partner assignment notifications for order ${orderId}`);

  try {
    // Fetch complete order data and all related profiles
    const order = await fetchCompleteOrderData(orderId);
    const [partner, buyer, seller, product] = await Promise.all([
      fetchUserProfile(partnerId),
      fetchUserProfile(order.buyer_id),
      fetchUserProfile(order.seller_id),
      fetchProductDetails(order.product_id)
    ]);

    const placeholders = {
      order_id: orderId,
      partner_id: partnerId,
      product_id: order.product_id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      scheduled_date: formatDate(order.rental_start_date)
    };

    // Notify delivery partner
    await sendNotification({
      userId: partnerId,
      eventType: 'order_assigned',
      placeholders
    });

    // Notify all admins
    const { data: admins, error: adminError } = await supabaseDB
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (adminError) {
      console.error(`❌ Failed to fetch admins:`, adminError.message);
    } else if (admins && admins.length > 0) {
      console.log(`👑 Notifying ${admins.length} admin(s) about delivery partner assignment`);
      
      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          eventType: 'delivery_partner_assigned',
          placeholders
        });
      }
    }

    console.log(`✅ Delivery partner assignment notifications sent successfully`);
    return { message: 'Delivery partner assignment notifications sent successfully' };
  } catch (error) {
    console.error(`❌ Failed to send delivery partner assignment notifications:`, error);
    throw error;
  }
}

export async function notifyProductPickup(
  orderId: string,
  partnerId: string
): Promise<{ message: string }> {
  console.log(`📦 Sending product pickup notifications for order ${orderId}`);

  try {
    const placeholders = {
      order_id: orderId,
      partner_id: partnerId,
      pickup_time: new Date().toLocaleString('en-IN')
    };

    // Fetch order to get seller and buyer IDs
    const order = await fetchCompleteOrderData(orderId);

    // Notify seller about pickup
    await sendNotification({
      userId: order.seller_id,
      eventType: 'product_picked_up',
      placeholders
    });

    // Notify buyer that product is out for delivery
    await sendNotification({
      userId: order.buyer_id,
      eventType: 'product_out_for_delivery',
      placeholders
    });

    // Notify all admins
    const { data: admins, error: adminError } = await supabaseDB
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (adminError) {
      console.error(`❌ Failed to fetch admins:`, adminError.message);
    } else if (admins && admins.length > 0) {
      console.log(`👑 Notifying ${admins.length} admin(s) about product pickup`);
      
      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          eventType: 'product_picked_up',
          placeholders
        });
      }
    }

    console.log(`✅ Product pickup notifications sent successfully`);
    return { message: 'Product pickup notifications sent successfully' };
  } catch (error) {
    console.error(`❌ Failed to send product pickup notifications:`, error);
    throw error;
  }
}

export async function notifyProductDelivery(
  orderId: string,
  partnerId: string
): Promise<{ message: string }> {
  console.log(`🚚 Sending product delivery notifications for order ${orderId}`);

  try {
    const placeholders = {
      order_id: orderId,
      partner_id: partnerId,
      delivery_time: new Date().toLocaleString('en-IN')
    };

    // Fetch order to get seller and buyer IDs
    const order = await fetchCompleteOrderData(orderId);

    // Notify seller about delivery completion
    await sendNotification({
      userId: order.seller_id,
      eventType: 'product_delivered',
      placeholders
    });

    // Notify buyer about successful delivery
    await sendNotification({
      userId: order.buyer_id,
      eventType: 'product_delivered',
      placeholders
    });

    // Notify all admins
    const { data: admins, error: adminError } = await supabaseDB
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (adminError) {
      console.error(`❌ Failed to fetch admins:`, adminError.message);
    } else if (admins && admins.length > 0) {
      console.log(`👑 Notifying ${admins.length} admin(s) about product delivery`);
      
      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          eventType: 'product_delivered',
          placeholders
        });
      }
    }

    console.log(`✅ Product delivery notifications sent successfully`);
    return { message: 'Product delivery notifications sent successfully' };
  } catch (error) {
    console.error(`❌ Failed to send product delivery notifications:`, error);
    throw error;
  }
}

export async function sendBulkNotification(
  userIds: string[], 
  eventType: string, 
  placeholders: Record<string, string> = {}
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`📬 Sending bulk notifications to ${userIds.length} users for event: ${eventType}`);

  for (const userId of userIds) {
    try {
      await sendNotification({ userId, eventType, placeholders });
      success++;
    } catch (error) {
      failed++;
      const errorMsg = `Failed for user ${userId}: ${(error as Error).message}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  console.log(`📊 Bulk notification results: ${success} success, ${failed} failed`);
  return { success, failed, errors };
}

export async function sendRoleBasedNotification(
  roles: Array<'seller' | 'buyer' | 'admin' | 'delivery_partner'>,
  eventType: string,
  placeholders: Record<string, string> = {},
  additionalFilters?: Record<string, any>
): Promise<{ success: number; failed: number; errors: string[] }> {
  let query = supabaseDB
    .from('profiles')
    .select('id')
    .in('role', roles);

  if (additionalFilters) {
    Object.entries(additionalFilters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }

  const { data: users, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  const userIds = users?.map(user => user.id) || [];
  return await sendBulkNotification(userIds, eventType, placeholders);
}

// Utility function to send order-based notifications with automatic data fetching
export async function sendOrderNotification(
  orderId: string,
  eventType: string,
  additionalPlaceholders: Record<string, string> = {}
): Promise<{ message: string }> {
  console.log(`📨 Sending order-based notification for order ${orderId}, event: ${eventType}`);

  try {
    const order = await fetchCompleteOrderData(orderId);
    
    const basePlaceholders = {
      order_id: orderId,
      ...additionalPlaceholders
    };

    // Determine who to notify based on event type
    const notificationTargets: { userId: string; eventType: string }[] = [];

    switch (eventType) {
      case 'order_placed':
      case 'product_ready':
      case 'return_reminder':
      case 'late_fee_applied':
      case 'refund_processed':
        notificationTargets.push({ userId: order.buyer_id, eventType });
        break;

      case 'order_accepted':
      case 'product_returned':
      case 'late_return':
      case 'security_deposit_refunded':
      case 'payout_sent':
        notificationTargets.push({ userId: order.seller_id, eventType });
        break;

      case 'product_picked_up':
      case 'product_delivered':
        // These notify multiple parties
        if (eventType === 'product_picked_up') {
          notificationTargets.push(
            { userId: order.seller_id, eventType: 'product_picked_up' },
            { userId: order.buyer_id, eventType: 'product_out_for_delivery' }
          );
        } else {
          notificationTargets.push(
            { userId: order.seller_id, eventType: 'product_delivered' },
            { userId: order.buyer_id, eventType: 'product_delivered' }
          );
        }
        break;

      default:
        throw new Error(`Unsupported order event type: ${eventType}`);
    }

    // Send notifications to all targets
    for (const target of notificationTargets) {
      await sendNotification({
        userId: target.userId,
        eventType: target.eventType,
        placeholders: basePlaceholders
      });
    }

    console.log(`✅ Order notification sent successfully for ${notificationTargets.length} recipients`);
    return { message: `Order notifications sent successfully to ${notificationTargets.length} recipients` };
  } catch (error) {
    console.error(`❌ Failed to send order notification:`, error);
    throw error;
  }
}