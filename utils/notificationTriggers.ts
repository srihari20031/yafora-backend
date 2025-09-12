import { sendBulkNotification, sendNotification } from "../src/services/notificationService";

export class NotificationTriggers {
  // User Registration & KYC Related
  static async triggerAccountCreated(userId: string, role: 'seller' | 'buyer' | 'delivery_partner') {
    console.log(`Triggering account_created notification for user ${userId} with role ${role}`);
    return await sendNotification({
      userId,
      eventType: 'account_created',
      placeholders: { role }
    });
  }

  static async triggerKYCApproved(userId: string, role: 'seller' | 'buyer' | 'delivery_partner') {
    console.log(`Triggering kyc_approved notification for user ${userId} with role ${role}`);
    return await sendNotification({
      userId,
      eventType: 'kyc_approved',
      placeholders: { role }
    });
  }

  // Product Related
  static async triggerProductListed(sellerId: string, productName: string) {
    console.log(`Triggering product_listed notification for seller ${sellerId} for product ${productName}`);
    return await sendNotification({
      userId: sellerId,
      eventType: 'product_listed',
      placeholders: { product_name: productName }
    });
  }

  static async triggerProductBooked(sellerId: string, productName: string, buyerName: string, rentalDate: string, deliveryMethod: string) {
    console.log(`Triggering product_booked notification for seller ${sellerId} for product ${productName}`);
    return await sendNotification({
      userId: sellerId,
      eventType: 'product_booked',
      placeholders: { 
        product_name: productName,
        buyer_name: buyerName,
        rental_date: rentalDate,
        delivery_method: deliveryMethod
      }
    });
  }

  // Rental Related
  static async triggerRentalConfirmed(buyerId: string, productName: string, rentalPeriod: string, pickupLocation: string) {
    console.log(`Triggering rental_confirmed notification for buyer ${buyerId} for product ${productName}`);
    return await sendNotification({
      userId: buyerId,
      eventType: 'rental_confirmed',
      placeholders: { 
        product_name: productName,
        rental_period: rentalPeriod,
        pickup_location: pickupLocation
      }
    });
  }

  static async triggerProductReturned(sellerId: string, productName: string, orderId: string, amount: string) {
    console.log(`Triggering product_returned notification for seller ${sellerId} for product ${productName} with order ${orderId}`);
    return await sendNotification({
      userId: sellerId,
      eventType: 'product_returned',
      placeholders: { 
        product_name: productName,
        order_id: orderId,
        amount: amount
      }
    });
  }

  // Late Return & Damage
  static async triggerLateReturn(sellerId: string, buyerId: string, productName: string, buyerName: string, orderId: string) {
    console.log(`Triggering late_return notification for seller ${sellerId} and admins for product ${productName} with order ${orderId}`);
    // Notify seller
    await sendNotification({
      userId: sellerId,
      eventType: 'late_return',
      placeholders: { 
        product_name: productName,
        buyer_name: buyerName
      }
    });

    // This will also notify admins automatically due to the admin notification logic
  }

  static async triggerLateFeeApplied(buyerId: string, productName: string, amount: string) {
    console.log(`Triggering late_fee_applied notification for buyer ${buyerId} for product ${productName}`);
    return await sendNotification({
      userId: buyerId,
      eventType: 'late_fee_applied',
      placeholders: { 
        product_name: productName,
        amount: amount
      }
    });
  }

  // Security Deposit & Refunds
  static async triggerSecurityDepositRefunded(sellerId: string, productName: string) {
    console.log(`Triggering security_deposit_refunded notification for seller ${sellerId} for product ${productName}`);
    return await sendNotification({
      userId: sellerId,
      eventType: 'security_deposit_refunded',
      placeholders: { product_name: productName }
    });
  }

  static async triggerRefundProcessed(buyerId: string, productName: string) {
    console.log(`Triggering refund_processed notification for buyer ${buyerId} for product ${productName}`);
    return await sendNotification({
      userId: buyerId,
      eventType: 'refund_processed',
      placeholders: { product_name: productName }
    });
  }

  // Payout Related
  static async triggerPayoutSent(sellerId: string, amount: string, productName: string) {
    console.log(`Triggering payout_sent notification for seller ${sellerId} for product ${productName}`);
    return await sendNotification({
      userId: sellerId,
      eventType: 'payout_sent',
      placeholders: { 
        amount: amount,
        product_name: productName
      }
    });
  }

  // Reviews
  static async triggerReviewReceived(sellerId: string, productName: string) {
    console.log(`Triggering review_received notification for seller ${sellerId} for product ${productName}`);
    return await sendNotification({
      userId: sellerId,
      eventType: 'review_received',
      placeholders: { product_name: productName }
    });
  }

  static async triggerReviewRequest(buyerId: string, productName: string) {
    console.log(`Triggering review_request notification for buyer ${buyerId} for product ${productName}`);
    return await sendNotification({
      userId: buyerId,
      eventType: 'review_request',
      placeholders: { product_name: productName }
    });
  }

  // Admin Specific
  static async triggerNewUserRegistered(userId: string, role: 'seller' | 'buyer' | 'delivery_partner') {
    console.log(`Triggering new_user_registered notification for user ${userId} with role ${role}`);
    // This will automatically notify all admins
    return await sendNotification({
      userId: userId,
      eventType: 'new_user_registered',
      placeholders: { role }
    });
  }

  static async triggerDamageReported(sellerId: string, buyerId: string, productName: string, orderId: string) {
    console.log(`Triggering damage_reported notification for seller ${sellerId} and damage_claim for buyer ${buyerId} for product ${productName} with order ${orderId}`);
    // Notify seller
    await sendNotification({
      userId: sellerId,
      eventType: 'damage_reported',
      placeholders: { product_name: productName }
    });

    // Notify buyer
    await sendNotification({
      userId: buyerId,
      eventType: 'damage_claim',
      placeholders: { product_name: productName }
    });

    // Admins will be notified automatically
  }

  // Delivery Partner Related
  static async triggerDeliveryAssigned(deliveryPartnerId: string, orderId: string, productName: string, pickupAddress: string, deliveryAddress: string) {
    console.log(`Triggering delivery_assigned notification for delivery partner ${deliveryPartnerId} for order ${orderId}`);
    return await sendNotification({
      userId: deliveryPartnerId,
      eventType: 'delivery_assigned',
      placeholders: { 
        order_id: orderId,
        product_name: productName,
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress
      }
    });
  }

  static async triggerDeliveryStatusUpdated(deliveryPartnerId: string, orderId: string, status: string, productName: string) {
    console.log(`Triggering delivery_status_updated notification for delivery partner ${deliveryPartnerId} for order ${orderId} with status ${status}`);
    return await sendNotification({
      userId: deliveryPartnerId,
      eventType: 'delivery_status_updated',
      placeholders: { 
        order_id: orderId,
        status,
        product_name: productName
      }
    });
  }

  static async triggerDeliveryReassigned(deliveryPartnerId: string, orderId: string, productName: string, reason?: string) {
    console.log(`Triggering delivery_reassigned notification for delivery partner ${deliveryPartnerId} for order ${orderId}`);
    return await sendNotification({
      userId: deliveryPartnerId,
      eventType: 'delivery_reassigned',
      placeholders: { 
        order_id: orderId,
        product_name: productName,
        reason: reason || 'No reason provided'
      }
    });
  }

  static async triggerDeliveryAssignmentRemoved(deliveryPartnerId: string, orderId: string, productName: string, reason?: string) {
    console.log(`Triggering delivery_assignment_removed notification for delivery partner ${deliveryPartnerId} for order ${orderId}`);
    return await sendNotification({
      userId: deliveryPartnerId,
      eventType: 'delivery_assignment_removed',
      placeholders: { 
        order_id: orderId,
        product_name: productName,
        reason: reason || 'No reason provided'
      }
    });
  }

  // Bulk notifications for promotions/offers
  static async triggerOfferActivated(userIds: string[], offerDetails: string) {
    console.log(`Triggering offer_activated bulk notification for ${userIds.length} users`);
    return await sendBulkNotification(userIds, 'offer_received', { offer_details: offerDetails });
  }

  // Reminder notifications
  static async triggerReturnReminder(buyerId: string, productName: string, dueDate: string) {
    console.log(`Triggering return_reminder notification for buyer ${buyerId} for product ${productName} due on ${dueDate}`);
    return await sendNotification({
      userId: buyerId,
      eventType: 'return_reminder',
      placeholders: { 
        product_name: productName,
        date: dueDate
      }
    });
  }
}

export const NotificationHelpers = {
  // When admin updates order status
  async handleOrderStatusUpdate(orderId: string, newStatus: string, orderDetails: any) {
    const { sellerId, buyerId, productName, amount, deliveryPartnerId, pickupAddress, deliveryAddress } = orderDetails;
    console.log(`Handling order status update for order ${orderId} to status ${newStatus}`);

    switch (newStatus) {
      case 'delivered':
        console.log(`Triggering product_booked for order ${orderId}`);
        await NotificationTriggers.triggerProductBooked(
          sellerId, 
          productName, 
          orderDetails.buyerName,
          orderDetails.rentalDate,
          orderDetails.deliveryMethod
        );
        // Notify delivery partner if assigned
        if (deliveryPartnerId) {
          await NotificationTriggers.triggerDeliveryStatusUpdated(
            deliveryPartnerId,
            orderId,
            newStatus,
            productName
          );
        }
        break;

      case 'returned':
        console.log(`Triggering product_returned and return_received for order ${orderId}`);
        await NotificationTriggers.triggerProductReturned(
          sellerId, 
          productName, 
          orderId, 
          amount
        );
        await sendNotification({
          userId: buyerId,
          eventType: 'return_received',
          placeholders: { product_name: productName }
        });
        // Notify delivery partner if assigned
        if (deliveryPartnerId) {
          await NotificationTriggers.triggerDeliveryStatusUpdated(
            deliveryPartnerId,
            orderId,
            newStatus,
            productName
          );
        }
        break;

      case 'cancelled':
        console.log(`Handling cancellation for order ${orderId}`);
        // Notify delivery partner if assigned
        if (deliveryPartnerId) {
          await NotificationTriggers.triggerDeliveryAssignmentRemoved(
            deliveryPartnerId,
            orderId,
            productName,
            'Order cancelled'
          );
        }
        break;
    }
  },

  // When admin applies late fee
  async handleLateFeeApplication(orderId: string, amount: number, orderDetails: any) {
    const { buyerId, sellerId, productName, buyerName } = orderDetails;
    console.log(`Handling late fee application for order ${orderId} with amount ${amount}`);

    await NotificationTriggers.triggerLateFeeApplied(buyerId, productName, amount.toString());
    await NotificationTriggers.triggerLateReturn(sellerId, buyerId, productName, buyerName, orderId);
  },

  // When admin processes security deposit
  async handleSecurityDepositProcessing(orderId: string, action: string, orderDetails: any) {
    const { buyerId, sellerId, productName } = orderDetails;
    console.log(`Handling security deposit processing for order ${orderId} with action ${action}`);

    if (action === 'release') {
      await NotificationTriggers.triggerRefundProcessed(buyerId, productName);
      await NotificationTriggers.triggerSecurityDepositRefunded(sellerId, productName);
    }
  },

  // When admin approves KYC
  async handleKYCApproval(userId: string, role: 'seller' | 'buyer' | 'delivery_partner') {
    console.log(`Handling KYC approval for user ${userId} with role ${role}`);
    await NotificationTriggers.triggerKYCApproved(userId, role);
  },

  // When admin assigns delivery
  async handleDeliveryAssignment(orderId: string, deliveryPartnerId: string, orderDetails: any) {
    const { productName, pickupAddress, deliveryAddress } = orderDetails;
    console.log(`Handling delivery assignment for order ${orderId} to delivery partner ${deliveryPartnerId}`);

    await NotificationTriggers.triggerDeliveryAssigned(
      deliveryPartnerId,
      orderId,
      productName,
      pickupAddress,
      deliveryAddress
    );
  },

  // When admin reassigns delivery
  async handleDeliveryReassignment(orderId: string, oldDeliveryPartnerId: string | null, newDeliveryPartnerId: string, orderDetails: any, reason?: string) {
    const { productName, pickupAddress, deliveryAddress } = orderDetails;
    console.log(`Handling delivery reassignment for order ${orderId} to new delivery partner ${newDeliveryPartnerId}`);

    // Notify old delivery partner if exists
    if (oldDeliveryPartnerId) {
      await NotificationTriggers.triggerDeliveryAssignmentRemoved(
        oldDeliveryPartnerId,
        orderId,
        productName,
        reason || 'Reassigned to another delivery partner'
      );
    }

    // Notify new delivery partner
    await NotificationTriggers.triggerDeliveryAssigned(
      newDeliveryPartnerId,
      orderId,
      productName,
      pickupAddress,
      deliveryAddress
    );
  },

  // When admin removes delivery assignment
  async handleDeliveryAssignmentRemoval(orderId: string, deliveryPartnerId: string, orderDetails: any, reason?: string) {
    const { productName } = orderDetails;
    console.log(`Handling delivery assignment removal for order ${orderId} from delivery partner ${deliveryPartnerId}`);

    await NotificationTriggers.triggerDeliveryAssignmentRemoved(
      deliveryPartnerId,
      orderId,
      productName,
      reason || 'Assignment removed by admin'
    );
  },

  // When delivery partner updates status
  async handleDeliveryStatusUpdate(assignmentId: string, status: string, deliveryDetails: any) {
    const { deliveryPartnerId, orderId, productName } = deliveryDetails;
    console.log(`Handling delivery status update for assignment ${assignmentId} to status ${status}`);

    await NotificationTriggers.triggerDeliveryStatusUpdated(
      deliveryPartnerId,
      orderId,
      status,
      productName
    );

    // Notify admins for completion or cancellation
    if (status === 'completed' || status === 'cancelled') {
      await sendNotification({
        userId: deliveryPartnerId, // Admins will be notified automatically
        eventType: `delivery_${status}`,
        placeholders: { 
          order_id: orderId,
          product_name: productName,
          status
        }
      });
    }
  }
};