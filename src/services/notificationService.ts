import supabaseDB from '../../config/connectDB';
import { sendTemplatedEmail } from '../../utils/sendEmail'; // Updated import

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  whatsapp_notifications: boolean;
  email_notifications: boolean;
  role: 'seller' | 'buyer' | 'admin';
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

// ... keep all your existing templates as they are ...
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
    product_delivered: {
      inApp: 'Your product {{product_name}} has been picked up by the buyer.'
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
    product_ready: {
      inApp: 'Your item {{product_name}} is ready for pickup/delivery.'
    },
    return_reminder: {
      inApp: 'Reminder: Return {{product_name}} by {{date}} to avoid late fees.'
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
function getEmailTemplateType(eventType: string, role: string): 'kyc' | 'product' | 'rental' | 'admin' {
  if (role === 'admin') return 'admin';
  if (eventType.includes('kyc')) return 'kyc';
  if (eventType.includes('rental') || eventType.includes('confirmed') || eventType.includes('booked')) return 'rental';
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
    'rental_order_placed', 'product_returned_damaged', 'late_return', 'refund_payout_released'
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
  roles: Array<'seller' | 'buyer' | 'admin'>,
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