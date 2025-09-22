import supabaseDB from '../../config/connectDB';
import { sendTemplatedEmail } from '../../utils/sendEmail'; // Updated import

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

interface NotificationTemplate {
  inApp: string;
  whatsapp?: string;
  email?: {
    subject: string;
    body: string;
  };
}

const notificationTemplates: Record<string, Record<string, NotificationTemplate>> = {
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
    product_booked: {
      inApp: 'You have a new rental request for {{product_name}}.',
      whatsapp: 'Yafora: Hello {{full_name}}, A buyer has requested to rent your product {{product_name}}. Please respond promptly to ensure smooth coordination. Thank you – Team Yafora',
      email: {
        subject: 'You\'ve Got a Booking!',
        body: 'Hello {{full_name}},\n\nGreat news! Your product, "{{product_name}}", has been rented by a customer. Please prepare it for dispatch.\n\n📅 Rental Date: {{rental_date}}\n📍 Pickup/Delivery Method: {{delivery_method}}\n\nKeep up the great listings!\n\nCheers,\nThe Yafora Team'
      }
    },
    // NEW: Product picked up from seller
    product_picked_up: {
      inApp: 'Your product {{product_name}} has been picked up by our delivery partner.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your product {{product_name}} has been successfully picked up by our delivery partner {{partner_name}}. It\'s now on its way to the customer. Thank you for your cooperation! – Team Yafora',
      email: {
        subject: 'Product Picked Up - {{product_name}}',
        body: 'Dear {{full_name}},\n\nYour product "{{product_name}}" has been successfully picked up by our delivery partner {{partner_name}}.\n\n📦 Order Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Customer: {{customer_name}}\n- Pickup Time: {{pickup_time}}\n- Delivery Partner: {{partner_name}}\n\nThe item is now on its way to the customer. You can track the delivery status in your dashboard.\n\nThank you for your prompt cooperation!\n\nBest regards,\nTeam Yafora'
      }
    },
    product_delivered: {
      inApp: 'Your product {{product_name}} has been delivered to the customer.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your product {{product_name}} has been successfully delivered to {{customer_name}}. The rental period has begun. Thank you! – Team Yafora',
      email: {
        subject: 'Product Delivered Successfully - {{product_name}}',
        body: 'Dear {{full_name}},\n\nGreat news! Your product "{{product_name}}" has been successfully delivered to the customer.\n\n📦 Delivery Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Customer: {{customer_name}}\n- Delivered At: {{delivery_time}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n\nThe rental period has officially begun. You can expect the product to be returned after the rental period ends.\n\nThank you for being a valued partner!\n\nBest regards,\nTeam Yafora'
      }
    },
    product_returned: {
      inApp: 'Your product {{product_name}} has been returned successfully.',
      email: {
        subject: 'Return Verified – Payment on the Way',
        body: 'Hi {{full_name}},\n\nThe returned product for Order #{{order_id}} has been successfully verified.\n\n💰 Your payout of ₹{{amount}} will be processed and credited to your account within 2 working days.\n\nThanks for being a valued partner.\n\nRegards,\nTeam Yafora'
      }
    },
    late_return: {
      inApp: 'Buyer has delayed return of {{product_name}}. Late fee applicable.',
      whatsapp: 'Yafora: Hello {{full_name}}, Please be informed that {{buyer_name}} has not returned the item {{product_name}} on time. A late fee is applicable as per policy. We\'ll keep you updated. Stay assured – Team Yafora'
    },
    damage_reported: {
      inApp: 'A damage claim has been raised for {{product_name}}. Admin review in progress.'
    },
    security_deposit_refunded: {
      inApp: 'Security deposit refunded to buyer.',
      email: {
        subject: 'Buyer Refund Processed for {{product_name}}',
        body: 'Dear {{full_name}},\n\nThe security deposit collected for {{product_name}} has been refunded to the buyer. No damage or late issues were found.\n\nThank you for your service.\nTeam Yafora'
      }
    },
    offer_activated: {
      inApp: 'Your product {{product_name}} is now under an offer. Visibility boosted.'
    },
    review_received: {
      inApp: 'You received a review for {{product_name}}. Check it now!'
    },
    payout_sent: {
      inApp: 'Payout of ₹{{amount}} for {{product_name}} has been credited to your account.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental earnings of ₹{{amount}} for {{product_name}} have been credited. Keep sharing elegance, keep earning! Thank you – Team Yafora'
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
    rental_confirmed: {
      inApp: 'Your rental for {{product_name}} is confirmed.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental for {{product_name}} is confirmed. Kindly ensure pickup/delivery readiness. Shine on – Team Yafora ✨',
      email: {
        subject: 'Your Rental is Confirmed!',
        body: 'Hi {{full_name}},\n\nYour rental for "{{product_name}}" has been confirmed!\n\n📅 Rental Period: {{rental_period}}\n📍 Pickup Location: {{pickup_location}}\n\nWe hope you shine in your special moment.\n\nWith love,\nYafora Team'
      }
    },
    // NEW: Product out for delivery
    product_out_for_delivery: {
      inApp: 'Your rental item {{product_name}} is out for delivery.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental item {{product_name}} is now out for delivery! Our delivery partner {{partner_name}} will contact you shortly. Please be available at the delivery address. – Team Yafora',
      email: {
        subject: 'Your Rental is Out for Delivery - {{product_name}}',
        body: 'Hi {{full_name}},\n\nGreat news! Your rental item "{{product_name}}" is now out for delivery.\n\n🚚 Delivery Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Delivery Partner: {{partner_name}}\n- Partner Contact: {{partner_phone}}\n- Expected Delivery: {{expected_delivery_time}}\n- Delivery Address: {{delivery_address}}\n\nPlease ensure someone is available at the delivery address. Our delivery partner will contact you before arrival.\n\nGet ready to shine!\n\nBest regards,\nYafora Team'
      }
    },
    product_delivered: {
      inApp: 'Your rental item {{product_name}} has been delivered successfully!',
      whatsapp: 'Yafora: Hello {{full_name}}, Your rental item {{product_name}} has been delivered successfully! Enjoy your special moments. Please remember to return it by {{return_date}}. Shine bright! ✨ – Team Yafora',
      email: {
        subject: 'Delivery Confirmed - Enjoy Your Rental!',
        body: 'Hi {{full_name}},\n\nYour rental item "{{product_name}}" has been successfully delivered!\n\n✨ Rental Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n- Return Date: {{return_date}}\n\n📋 Important Reminders:\n• Please take good care of the item during your rental period\n• Return the item in the same condition you received it\n• Late returns will incur additional charges\n• Contact us immediately if you notice any issues\n\nEnjoy your special moments and shine bright!\n\nWith love,\nYafora Team'
      }
    },
    product_ready: {
      inApp: 'Your item {{product_name}} is ready for pickup/delivery.'
    },
    return_reminder: {
      inApp: 'Reminder: Return {{product_name}} by {{date}} to avoid late fees.',
      whatsapp: 'Yafora: Hello {{full_name}}, Gentle reminder to return {{product_name}} by {{return_date}} to avoid late fees. Thank you for your cooperation! – Team Yafora',
      email: {
        subject: 'Return Reminder - {{product_name}}',
        body: 'Hi {{full_name}},\n\nThis is a friendly reminder that your rental period for "{{product_name}}" is ending soon.\n\n📅 Return Date: {{return_date}}\n📍 Return Address: {{return_address}}\n\nPlease ensure the item is returned on time to avoid any late fees.\n\nThank you!\nYafora Team'
      }
    },
    return_received: {
      inApp: 'Thank you for returning {{product_name}}!'
    },
    late_fee_applied: {
      inApp: 'A late fee of ₹{{amount}} has been added for {{product_name}}.',
      whatsapp: 'Yafora: Hello {{full_name}}, This is a gentle reminder that your return for {{product_name}} was delayed. As per policy, a late fee of ₹{{amount}} is applicable. We understand life happens, and we appreciate your cooperation. Thank you – Team Yafora'
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
      inApp: '{{full_name}} listed {{product_name}}. Pending moderation.'
    },
    rental_order_placed: {
      inApp: 'Rental order placed: {{product_name}} by {{buyer_name}}.'
    },
    // NEW: Product pickup completed notification for admin
    product_picked_up: {
      inApp: 'Product {{product_name}} picked up by delivery partner {{partner_name}} for Order #{{order_id}}.',
      email: {
        subject: 'Pickup Completed - Order #{{order_id}}',
        body: 'Hello Admin,\n\nThe pickup has been successfully completed for the following order:\n\n📦 Order Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Seller: {{seller_name}}\n- Buyer: {{customer_name}}\n- Delivery Partner: {{partner_name}}\n- Pickup Time: {{pickup_time}}\n\nThe item is now in transit to the customer. Next status expected: Delivery completion.\n\nSystem Update,\nYafora Operations'
      }
    },
    // NEW: Product delivery completed notification for admin
    product_delivered: {
      inApp: 'Product {{product_name}} delivered to {{customer_name}} for Order #{{order_id}}.',
      email: {
        subject: 'Delivery Completed - Order #{{order_id}}',
        body: 'Hello Admin,\n\nThe delivery has been successfully completed for the following order:\n\n📦 Delivery Details:\n- Order ID: #{{order_id}}\n- Product: {{product_name}}\n- Seller: {{seller_name}}\n- Customer: {{customer_name}}\n- Delivery Partner: {{partner_name}}\n- Delivery Time: {{delivery_time}}\n- Rental Period: {{rental_start_date}} to {{rental_end_date}}\n\nThe rental period has officially begun. The system will automatically send return reminders as the return date approaches.\n\nSystem Update,\nYafora Operations'
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
      inApp: 'Late return for {{product_name}} by {{buyer_name}}. Apply penalty.',
      email: {
        subject: 'Alert: Rental Order #{{order_id}} Flagged',
        body: 'Hello Admin,\n\nThe rental order #{{order_id}} has been marked as Late/Damaged by the return team.\n\nPlease initiate further action such as late fees, damage charges, or dispute resolution.\n\n🚨 Immediate attention required.\n\nSystem Notification\nYafora Ops Team'
      }
    },
    refund_payout_released: {
      inApp: 'Refund of ₹{{amount}} sent to {{buyer_name}}. Payout to {{seller_name}} approved.'
    },
    delivery_partner_assigned: {
      inApp: 'Order #{{order_id}} has been assigned to delivery partner {{partner_name}}.',
      email: {
        subject: 'Delivery Partner Assigned - Order #{{order_id}}',
        body: 'Hello Admin,\n\nOrder #{{order_id}} for {{product_name}} has been assigned to delivery partner {{partner_name}}.\n\n📦 Order Details:\n- Product: {{product_name}}\n- Buyer: {{buyer_name}}\n- Seller: {{seller_name}}\n- Partner: {{partner_name}}\n- Partner Contact: {{partner_phone}}\n\nThe delivery partner has been notified and will begin the pickup/delivery process.\n\nBest regards,\nYafora System'
      }
    },
    delivery_status_updated: {
      inApp: 'Delivery status updated for Order #{{order_id}}: {{status}}',
      email: {
        subject: 'Delivery Status Update - Order #{{order_id}}',
        body: 'Hello Admin,\n\nThe delivery status for Order #{{order_id}} has been updated.\n\n📋 Status Update:\n- Order ID: {{order_id}}\n- Product: {{product_name}}\n- New Status: {{status}}\n- Partner: {{partner_name}}\n- Updated At: {{updated_at}}\n\nPlease monitor the progress as needed.\n\nBest regards,\nYafora System'
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
        body: 'Hello {{full_name}},\n\nYou have been assigned a new delivery task:\n\n📦 Order Details:\n- Order ID: {{order_id}}\n- Product: {{product_name}}\n- Pickup Address: {{pickup_address}}\n- Delivery Address: {{delivery_address}}\n- Buyer Contact: {{buyer_phone}}\n- Seller Contact: {{seller_phone}}\n- Scheduled Date: {{scheduled_date}}\n\nPlease confirm acceptance and coordinate with both parties for smooth pickup and delivery.\n\nBest regards,\nYafora Operations Team'
      }
    },
    delivery_status_updated: {
      inApp: 'Status updated for Order #{{order_id}}: {{status}}',
      whatsapp: 'Yafora: Hello {{full_name}}, The status for Order #{{order_id}} has been updated to {{status}}. Thank you for the update! – Team Yafora',
      email: {
        subject: 'Delivery Status Confirmed - Order #{{order_id}}',
        body: 'Hello {{full_name}},\n\nThank you for updating the delivery status for Order #{{order_id}}.\n\n📋 Status Update:\n- Order ID: {{order_id}}\n- Product: {{product_name}}\n- Status: {{status}}\n- Updated At: {{updated_at}}\n\nIf this is a delivery completion, great job! If you encountered any issues, please contact support.\n\nBest regards,\nYafora Operations Team'
      }
    },
    payment_processed: {
      inApp: 'Payment of ₹{{amount}} for deliveries has been processed.',
      whatsapp: 'Yafora: Hello {{full_name}}, Your delivery payment of ₹{{amount}} has been processed and will be credited soon. Thank you for your service! 🚚💰 – Team Yafora'
    }
  }
};

function replacePlaceholders(template: string, placeholders: Record<string, string> = {}): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

// Helper function to determine email template type based on event
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

  // Get notification template
  const templates = notificationTemplates[role]?.[eventType];
  if (!templates) {
    console.error(`❌ No template found for role ${role} and event ${eventType}`);
    throw new Error(`No template found for role ${role} and event ${eventType}`);
  }

  // Prepare messages with placeholders
  const inAppMessage = replacePlaceholders(templates.inApp, { full_name, ...placeholders });
  const whatsappMessage = templates.whatsapp ? replacePlaceholders(templates.whatsapp, { full_name, ...placeholders }) : null;
  const emailMessage = templates.email
    ? {
        subject: replacePlaceholders(templates.email.subject, { full_name, ...placeholders }),
        body: replacePlaceholders(templates.email.body, { full_name, ...placeholders })
      }
    : null;

  console.log(`📋 Templates prepared. Email template exists: ${!!emailMessage}, User wants emails: ${email_notifications}, Testing mode: ${isTesting}`);

  // Insert In-App notification
  const { error: notificationError } = await supabaseDB
    .from('notifications')
    .insert({
      user_id: userId,
      type: eventType,
      message: inAppMessage,
      read: false,
      created_at: new Date().toISOString()
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
      
      // Use the updated sendTemplatedEmail function
      const templateType = getEmailTemplateType(eventType, role);
      await sendTemplatedEmail(email, emailMessage.subject, emailMessage.body, templateType);
      
      console.log(`✅ Email sent successfully to ${email} for event: ${eventType}`);
    } catch (err) {
      console.error(`❌ Failed to send email notification to ${email}:`, err);
      // Don't throw error - let in-app notification succeed even if email fails
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

        const adminMessage = replacePlaceholders(adminTemplate.inApp, { full_name, role, ...placeholders });

        // Insert admin in-app notification
        const { error: adminNotificationError } = await supabaseDB
          .from('notifications')
          .insert({
            user_id: admin.id,
            type: eventType,
            message: adminMessage,
            read: false,
            created_at: new Date().toISOString()
          });

        if (adminNotificationError) {
          console.error(`❌ Failed to create admin notification:`, adminNotificationError.message);
        } else {
          console.log(`✅ Admin in-app notification created for ${admin.full_name}`);
        }

        // Send admin email if enabled and template exists
        if (admin.email_notifications && admin.email && adminTemplate.email && !isTesting) {
          try {
            console.log(`📧 Sending admin email to ${admin.email}`);
            
            await sendTemplatedEmail(
              admin.email,
              replacePlaceholders(adminTemplate.email.subject, { full_name, role, ...placeholders }),
              replacePlaceholders(adminTemplate.email.body, { full_name, role, ...placeholders }),
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

// Helper function to send notifications when delivery partner is assigned
export async function notifyDeliveryPartnerAssignment(
  orderId: string,
  partnerId: string,
  orderDetails: {
    product_name: string;
    buyer_name: string;
    seller_name: string;
    pickup_address: string;
    delivery_address: string;
    buyer_phone?: string;
    seller_phone?: string;
    scheduled_date?: string;
  }
): Promise<{ message: string }> {
  console.log(`🚚 Sending delivery partner assignment notifications for order ${orderId}`);

  // Get partner details
  const { data: partner, error: partnerError } = await supabaseDB
    .from('profiles')
    .select('full_name, phone_number')
    .eq('id', partnerId)
    .single();

  if (partnerError || !partner) {
    console.error(`❌ Failed to fetch partner details:`, partnerError?.message);
    throw new Error(`Failed to fetch partner details: ${partnerError?.message || 'Partner not found'}`);
  }

  const placeholders = {
    order_id: orderId,
    partner_name: partner.full_name,
    partner_phone: partner.phone_number || '',
    ...orderDetails
  };

  try {
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

// NEW: Helper function to handle product pickup notifications
export async function notifyProductPickup(
  orderId: string,
  partnerId: string,
  orderDetails: {
    product_name: string;
    seller_id: string;
    buyer_id: string;
    seller_name: string;
    customer_name: string;
    pickup_time: string;
  }
): Promise<{ message: string }> {
  console.log(`📦 Sending product pickup notifications for order ${orderId}`);

  // Get partner details
  const { data: partner, error: partnerError } = await supabaseDB
    .from('profiles')
    .select('full_name, phone_number')
    .eq('id', partnerId)
    .single();

  if (partnerError || !partner) {
    console.error(`❌ Failed to fetch partner details:`, partnerError?.message);
    throw new Error(`Failed to fetch partner details: ${partnerError?.message || 'Partner not found'}`);
  }

  const placeholders = {
    order_id: orderId,
    partner_name: partner.full_name,
    partner_phone: partner.phone_number || '',
    ...orderDetails
  };

  try {
    // Notify seller about pickup
    await sendNotification({
      userId: orderDetails.seller_id,
      eventType: 'product_picked_up',
      placeholders
    });

    // Notify buyer that product is out for delivery
    await sendNotification({
      userId: orderDetails.buyer_id,
      eventType: 'product_out_for_delivery',
      placeholders: {
        ...placeholders,
        expected_delivery_time: 'within 2-4 hours', // You can calculate this based on distance
        delivery_address: 'As provided in order' // You can get actual address from order
      }
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

// NEW: Helper function to handle product delivery notifications
export async function notifyProductDelivery(
  orderId: string,
  partnerId: string,
  orderDetails: {
    product_name: string;
    seller_id: string;
    buyer_id: string;
    seller_name: string;
    customer_name: string;
    delivery_time: string;
    rental_start_date: string;
    rental_end_date: string;
    return_date: string;
  }
): Promise<{ message: string }> {
  console.log(`🚚 Sending product delivery notifications for order ${orderId}`);

  // Get partner details
  const { data: partner, error: partnerError } = await supabaseDB
    .from('profiles')
    .select('full_name, phone_number')
    .eq('id', partnerId)
    .single();

  if (partnerError || !partner) {
    console.error(`❌ Failed to fetch partner details:`, partnerError?.message);
    throw new Error(`Failed to fetch partner details: ${partnerError?.message || 'Partner not found'}`);
  }

  const placeholders = {
    order_id: orderId,
    partner_name: partner.full_name,
    partner_phone: partner.phone_number || '',
    ...orderDetails
  };

  try {
    // Notify seller about delivery completion
    await sendNotification({
      userId: orderDetails.seller_id,
      eventType: 'product_delivered',
      placeholders
    });

    // Notify buyer about successful delivery
    await sendNotification({
      userId: orderDetails.buyer_id,
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

// Helper function to send bulk notifications to multiple users
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

// Helper function to send notifications based on user roles
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

  // Apply additional filters if provided
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