import { Router } from "express";
import {
    createNewRental,
    getRental,
    getBuyerRentals,
    getSellerRentals,
    updateRentalDetails,
    updateRentalDeliveryStatus,
    updateRentalPaymentStatus,
    processRentalReturn,
    reportRentalDamage,
    reviewRentalDamage,
    releaseRentalSecurityDeposit,
    getActiveRentalsList,
    getOverdueRentalsList,
    cancelRentalOrder,
    extendRental,
    assignDeliveryPartner,
    addAdminNote
} from "../controller/orderController";

const router = Router();

// Core rental operations
router.post('/', createNewRental);
router.get('/:rentalId', getRental);
router.put('/:rentalId', updateRentalDetails);
router.delete('/:rentalId', cancelRentalOrder);

// User-specific rentals
router.get('/buyer/:buyerId', getBuyerRentals);
router.get('/seller/:sellerId', getSellerRentals);

// Delivery management
router.put('/:rentalId/delivery-status', updateRentalDeliveryStatus);
router.put('/:rentalId/assign-delivery', assignDeliveryPartner);

// Payment management
router.put('/:rentalId/payment-status', updateRentalPaymentStatus);

// Return management
router.put('/:rentalId/return', processRentalReturn);

// Damage management
router.post('/:rentalId/damage', reportRentalDamage);
router.put('/:rentalId/damage/review', reviewRentalDamage);

// Security deposit management
router.put('/:rentalId/security-deposit/release', releaseRentalSecurityDeposit);

// Admin operations
router.put('/:rentalId/extend', extendRental);
router.post('/:rentalId/admin-note', addAdminNote);

// List operations
router.get('/list/active', getActiveRentalsList);
router.get('/list/overdue', getOverdueRentalsList);

export default router;