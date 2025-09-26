import { Request, Response } from 'express';
import * as DeliveryService from '../services/deliveryService';
import { AuthenticatedRequest } from '../middleware/authMiddlware';
import { NotificationHelpers } from '../../utils/notificationTriggers';

export async function getAssignedDeliveries(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'User authentication required' });
      return;
    }
    
    const deliveries = await DeliveryService.getAssignedDeliveries(req.user.id);

    console.log(`📦 Fetched ${deliveries.length} assigned deliveries for partner ${req.user.id}`);
    console.log('Deliveries:', deliveries);
    res.status(200).json(deliveries);
  } catch (error) {
    console.error('Error fetching assigned deliveries:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function updateDeliveryStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params;
    const { status } = req.body;
    
    if (!req.user?.id) {
      res.status(401).json({ error: 'User authentication required' });
      return;
    }
    if (!assignmentId || !status) {
      res.status(400).json({ error: 'Assignment ID and status are required' });
      return;
    }
    if (!['accepted', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const result = await DeliveryService.updateDeliveryStatus(
      assignmentId,
      req.user.id,
      status
    );

    // Trigger notification for status update using data from service
    await NotificationHelpers.handleDeliveryStatusUpdate(
      assignmentId,
      status,
      {
        deliveryPartnerId: req.user.id,
        orderId: result.notificationData.orderId,
        productName: result.notificationData.productName
      }
    );

    // Log important status changes
    if (status === 'accepted') {
      console.log(`✅ Delivery partner ${req.user.id} accepted assignment ${assignmentId} for order ${result.notificationData.orderId}`);
    } else if (status === 'completed') {
      console.log(`🎉 Delivery completed for assignment ${assignmentId} by partner ${req.user.id}`);
    } else if (status === 'cancelled') {
      console.log(`❌ Delivery cancelled for assignment ${assignmentId} by partner ${req.user.id}`);
    }

    res.status(200).json(result.assignment);
  } catch (error) {
    console.error('Error updating delivery status:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getDeliveryHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'User authentication required' });
      return;
    }
    const { status } = req.query;
    const history = await DeliveryService.getDeliveryHistory(
      req.user.id,
      status as 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | undefined
    );
    res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching delivery history:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function addDeliveryNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params;
    const { notes } = req.body;
    
    if (!req.user?.id) {
      res.status(401).json({ error: 'User authentication required' });
      return;
    }
    if (!assignmentId || !notes) {
      res.status(400).json({ error: 'Assignment ID and notes are required' });
      return;
    }
    const updatedAssignment = await DeliveryService.addDeliveryNotes(
      assignmentId,
      req.user.id,
      notes
    );
    res.status(200).json(updatedAssignment);
  } catch (error) {
    console.error('Error adding delivery notes:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}