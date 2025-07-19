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
        const updatedRental = await processReturn(rentalId, returnDate, collectionPhotoUrl);
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
        const updatedRental = await reportDamage(rentalId, description, photos, reviewerId);
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
        const updatedRental = await reviewDamage(rentalId, status, damageFee, reviewerId);
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
        const updatedRental = await releaseSecurityDeposit(rentalId, refundAmount, status);
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
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export async function cancelRentalOrder(req: Request, res: Response): Promise<void> {
    const { rentalId } = req.params;
    const { reason, adminId } = req.body;
    
    try {
        const cancelledRental = await cancelRental(rentalId, reason, adminId);
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
        res.status(200).json({ 
            message: 'Admin note added successfully', 
            rental: updatedRental 
        });
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}