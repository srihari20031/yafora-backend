import { Request, Response } from 'express';
import {
    createRental,
    getRentalById,
    getUserRentals,
    updateRental,
    updateDeliveryStatus,
    updatePaymentStatus,
    processReturn,
    reportDamage,
    reviewDamage,
    releaseSecurityDeposit,
    getActiveRentals,
    getOverdueRentals,
    cancelRental
} from '../services/orderService';
import { NotificationTriggers, NotificationHelpers } from '../../utils/notificationTriggers';

export async function createNewRental(req: Request, res: Response): Promise<void> {
    try {
        const {
            buyer_id,
            items,
            billing_info,
            payment_method,
            total_amount,
            special_instructions,
            promo_code_id,
            discount_amount,
            commission_amount
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'At least one rental item is required' });
            return;
        }

        const item = items[0]; // assuming single item rentals for now

        const rentalData = {
            buyerId: buyer_id,
            productId: item.product_id,
            sellerId: item.seller_id,
            rental_start_date: item.rental_start_date,
            rental_end_date: item.rental_end_date,
            rentalDurationDays: item.rental_duration_days || item.rental_durationDays,
            totalRentalPrice: item.rental_price,
            securityDeposit: item.security_deposit,
            tryOnFee: item.try_on_fee || 0,
            totalAmount: total_amount,
            pickupAddress: billing_info?.address || '',
            deliveryAddress: billing_info?.address || '',
            deliveryPartnerId: item.delivery_partner_id || null,
            promoCodeId: promo_code_id,
            discountAmount: discount_amount || 0,
            commissionAmount: commission_amount || 0
        };

        console.log('Normalized rental data for service:', rentalData);

        const rental = await createRental(rentalData);

        // Send notifications after successful rental creation
        try {
            // Get additional details for notifications (you might need to fetch these from your database)
            const productName = item.product_name || 'Product'; // Adjust based on your data structure
            const buyerName = billing_info?.name || 'Customer'; // Adjust based on your data structure
            const rentalDate = item.rental_start_date;
            const deliveryMethod = item.delivery_partner_id ? 'Delivery' : 'Pickup';
            const rentalPeriod = `${item.rental_start_date} to ${item.rental_end_date}`;
            const pickupLocation = billing_info?.address || 'TBD';

            console.log("Item: ", item);
            // Notify seller about new booking
            console.log('Sending notifications for new rental creation...');
            
            // ✅ FIX: Use seller_id from the created rental object, not from the original item
            const actualSellerId = rental.seller_id;
            
            console.log("For check:", actualSellerId,
                productName,
                buyerName,
                rentalDate,
                deliveryMethod);
                
            await NotificationTriggers.triggerProductBooked(
                actualSellerId, // ✅ Use the actual seller_id from database response
                productName,
                buyerName,
                rentalDate,
                deliveryMethod
            );

            // Notify buyer about rental confirmation
            await NotificationTriggers.triggerRentalConfirmed(
                buyer_id,
                productName,
                rentalPeriod,
                pickupLocation
            );

            // Notify admins about new rental order
            await NotificationHelpers.handleOrderStatusUpdate(
                rental.id,
                'confirmed',
                {
                    sellerId: actualSellerId, // ✅ Use the actual seller_id here too
                    buyerId: buyer_id,
                    productName,
                    buyerName,
                    rentalDate,
                    deliveryMethod,
                    amount: total_amount.toString()
                }
            );

            console.log('Notifications sent successfully for rental creation');
        } catch (notificationError) {
            console.error('Failed to send notifications for rental creation:', notificationError);
            // Don't fail the rental creation if notifications fail
        }

        res.status(201).json({
            message: 'Rental created successfully',
            rental
        });

    } catch (err) {
        console.error('Rental creation failed:', err);
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function getRental(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    
    try {
        const rental = await getRentalById(rentalId);
        res.status(200).json({ rental });
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

export async function getBuyerRentals(req: Request, res: Response): Promise<void> {
    const { buyerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    console.log(`Fetching rentals for buyer ${buyerId} with page=${page} and limit=${limit}`);
    
    try {
        const result = await getUserRentals(
            buyerId, 
            'buyer', 
            Number(page), 
            Number(limit)
        );

        console.log(`Fetched rentals for buyer ${buyerId}:`, result);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function getSellerRentals(req: Request, res: Response): Promise<void> {
    const { sellerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    try {
        const result = await getUserRentals(
            sellerId, 
            'seller', 
            Number(page), 
            Number(limit)
        );
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function updateRentalDetails(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const updateData = req.body;
    const adminId = req.body.adminId;
    
    try {
        const updatedRental = await updateRental(rentalId, updateData, adminId);
        res.status(200).json({ 
            message: 'Rental updated successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function updateRentalDeliveryStatus(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { status, deliveryPartnerId } = req.body;
    
    try {
        const updatedRental = await updateDeliveryStatus(rentalId, status, deliveryPartnerId);

        // Note: Delivery partner notifications are disabled as delivery partners aren't integrated yet
        // TODO: Enable delivery notifications once delivery partner integration is complete
        console.log(`Delivery status updated to ${status} for rental ${rentalId}`);

        res.status(200).json({ 
            message: 'Delivery status updated successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function updateRentalPaymentStatus(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { status } = req.body;
    
    try {
        const updatedRental = await updatePaymentStatus(rentalId, status);

        // Send notifications for payment status updates if needed
        try {
            if (status === 'completed') {
                const rental = await getRentalById(rentalId);
                const productName = rental.product_name || 'Product';
                const amount = rental.total_amount?.toString() || '0';

                // Notify seller about payout
                await NotificationTriggers.triggerPayoutSent(
                    rental.seller_id,
                    amount,
                    productName
                );
            }

            console.log('Payment status notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send payment status notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Payment status updated successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function processRentalReturn(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { returnDate, collectionPhotoUrl } = req.body;
    
    try {
        const rental = await getRentalById(rentalId);
        const updatedRental = await processReturn(rentalId, returnDate, collectionPhotoUrl);

        // Send return notifications
        try {
            const productName = rental.product_name || 'Product';
            const amount = rental.total_amount?.toString() || '0';

            // Notify seller about product return
            await NotificationTriggers.triggerProductReturned(
                rental.seller_id,
                productName,
                rentalId,
                amount
            );

            // Notify buyer about successful return
            await NotificationHelpers.handleOrderStatusUpdate(
                rentalId,
                'returned',
                {
                    sellerId: rental.seller_id,
                    buyerId: rental.buyer_id,
                    productName,
                    amount
                }
            );

            console.log('Return notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send return notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Return processed successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function reportRentalDamage(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { description, photos, reviewerId } = req.body;
    
    try {
        const rental = await getRentalById(rentalId);
        const updatedRental = await reportDamage(rentalId, description, photos, reviewerId);

        // Send damage report notifications
        try {
            const productName = rental.product_name || 'Product';

            await NotificationTriggers.triggerDamageReported(
                rental.seller_id,
                rental.buyer_id,
                productName,
                rentalId
            );

            console.log('Damage report notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send damage report notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Damage reported successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function reviewRentalDamage(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { status, damageFee, reviewerId } = req.body;
    
    try {
        const rental = await getRentalById(rentalId);
        const updatedRental = await reviewDamage(rentalId, status, damageFee, reviewerId);

        // Send damage review notifications
        try {
            const productName = rental.product_name || 'Product';

            if (status === 'approved' && damageFee > 0) {
                // Notify buyer about damage fee
                await NotificationTriggers.triggerLateFeeApplied(
                    rental.buyer_id,
                    productName,
                    damageFee.toString()
                );
            }

            console.log('Damage review notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send damage review notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Damage reviewed successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function releaseRentalSecurityDeposit(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { refundAmount, status } = req.body;
    
    try {
        const rental = await getRentalById(rentalId);
        const updatedRental = await releaseSecurityDeposit(rentalId, refundAmount, status);

        // Send security deposit release notifications
        try {
            const productName = rental.product_name || 'Product';

            await NotificationHelpers.handleSecurityDepositProcessing(
                rentalId,
                'release',
                {
                    buyerId: rental.buyer_id,
                    sellerId: rental.seller_id,
                    productName
                }
            );

            console.log('Security deposit release notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send security deposit release notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Security deposit released successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function getActiveRentalsList(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 10 } = req.query;
    
    try {
        const result = await getActiveRentals(Number(page), Number(limit));
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function getOverdueRentalsList(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 10 } = req.query;
    
    try {
        const result = await getOverdueRentals(Number(page), Number(limit));

        // Send notifications for overdue rentals
        try {
            if (result.rentals && result.rentals.length > 0) {
                for (const rental of result.rentals) {
                    const productName = rental.product_name || 'Product';
                    const buyerName = rental.buyer_name || 'Customer';

                    await NotificationTriggers.triggerLateReturn(
                        rental.seller_id,
                        rental.buyer_id,
                        productName,
                        buyerName,
                        rental.id
                    );
                }
            }

            console.log('Overdue rental notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send overdue rental notifications:', notificationError);
        }

        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function cancelRentalOrder(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { reason, adminId } = req.body;
    
    try {
        const rental = await getRentalById(rentalId);
        const cancelledRental = await cancelRental(rentalId, reason, adminId);

        // Send cancellation notifications
        try {
            const productName = rental.product_name || 'Product';

            // Notify buyer about cancellation
            // You might want to add a specific cancellation trigger in your NotificationTriggers
            await NotificationHelpers.handleOrderStatusUpdate(
                rentalId,
                'cancelled',
                {
                    sellerId: rental.seller_id,
                    buyerId: rental.buyer_id,
                    productName,
                    reason
                }
            );

            console.log('Cancellation notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send cancellation notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Rental cancelled successfully', 
            rental: cancelledRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function extendRental(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { newEndDate, additionalDays, additionalAmount } = req.body;
    
    try {
        const rental = await getRentalById(rentalId);
        
        const updateData = {
            rentalEndDate: newEndDate,
            expectedReturnDate: newEndDate,
            rentalDurationDays: rental.rental_duration_days + additionalDays,
            totalRentalPrice: rental.total_rental_price + additionalAmount,
            totalAmount: rental.total_amount + additionalAmount,
            lastAdminAction: 'extended'
        };
        
        const updatedRental = await updateRental(rentalId, updateData);

        // Send extension notifications
        try {
            const productName = rental.product_name || 'Product';

            // Notify buyer about rental extension
            // You might want to add a specific extension trigger
            // For now, using a generic notification approach
            await NotificationTriggers.triggerRentalConfirmed(
                rental.buyer_id,
                productName,
                `Extended until ${newEndDate}`,
                'Current location'
            );

            // Notify seller about extension
            await NotificationTriggers.triggerProductBooked(
                rental.seller_id,
                productName,
                rental.buyer_name || 'Customer',
                newEndDate,
                'Extension'
            );

            console.log('Extension notifications sent successfully');
        } catch (notificationError) {
            console.error('Failed to send extension notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Rental extended successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function assignDeliveryPartner(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { deliveryPartnerId, assignmentType = 'manual' } = req.body;
    
    try {
        const updateData = {
            deliveryPartnerId: deliveryPartnerId,
            deliveryAssignmentType: assignmentType,
            deliveryAssignedAt: new Date().toISOString(),
            deliveryStatus: 'accepted'
        };
        
        const updatedRental = await updateRental(rentalId, updateData);

        // Send delivery assignment notifications
        try {
            const rental = await getRentalById(rentalId);
            const productName = rental.product_name || 'Product';

            // Notify buyer about delivery partner assignment
            // You might want to add a specific delivery assignment trigger
            console.log(`Delivery partner ${deliveryPartnerId} assigned for rental ${rentalId}`);
        } catch (notificationError) {
            console.error('Failed to send delivery assignment notifications:', notificationError);
        }

        res.status(200).json({ 
            message: 'Delivery partner assigned successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function addAdminNote(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { note, adminId, action } = req.body;
    
    try {
        const updateData = {
            adminNotes: note,
            lastAdminAction: action,
            lastAdminActionBy: adminId,
            lastAdminActionAt: new Date().toISOString()
        };
        
        const updatedRental = await updateRental(rentalId, updateData);

        // Log admin action (notifications for admin notes might not be necessary)
        console.log(`Admin note added to rental ${rentalId} by admin ${adminId}: ${action}`);

        res.status(200).json({ 
            message: 'Admin note added successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}