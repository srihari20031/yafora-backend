import express from 'express';
import * as DeliveryController from '../controller/deliveryController';
import { authMiddleware, deliveryPartnerMiddleware } from '../middleware/authMiddlware';

const router = express.Router();

// Delivery partner routes
router.get('/assigned', 
  authMiddleware, 
  deliveryPartnerMiddleware, 
  DeliveryController.getAssignedDeliveries
);

router.patch('/assignments/:assignmentId/status', 
  authMiddleware, 
  deliveryPartnerMiddleware, 
  DeliveryController.updateDeliveryStatus
);

router.get('/history', 
  authMiddleware, 
  deliveryPartnerMiddleware, 
  DeliveryController.getDeliveryHistory
);

router.patch('/assignments/:assignmentId/notes', 
  authMiddleware, 
  deliveryPartnerMiddleware, 
  DeliveryController.addDeliveryNotes
);

export default router;