import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddlware';
import supabaseDB from '../../config/connectDB';
import { NotificationQueryParams, NotificationPreferences, UnreadNotificationCounts } from '../types/notification.types';

const notificationController = {
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { page = 1, limit = 20, read, priority, type, order_id, product_id } = req.query as NotificationQueryParams & { page?: number; limit?: number };

      let query = supabaseDB
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (read !== undefined) {
        query = query.eq('read', read);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (type) {
        query = query.eq('type', type);
      }

      if (order_id) {
        query = query.eq('order_id', order_id);
      }

      if (product_id) {
        query = query.eq('product_id', product_id);
      }

      const { data: notifications, error } = await query;

      if (error) {
        throw error;
      }

      res.json({ notifications });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { data: counts, error } = await supabaseDB
        .from('user_unread_notification_counts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no unread, return zeros
        if (error.code === 'PGRST116') {
          res.json({
            user_id: userId,
            unread_count: 0,
            urgent_count: 0,
            high_priority_count: 0
          } as UnreadNotificationCounts);
          return;
        }
        throw error;
      }

      res.json(counts as UnreadNotificationCounts);
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      const { error } = await supabaseDB
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId); // Ensure user owns the notification

      if (error) {
        throw error;
      }

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { error } = await supabaseDB
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        throw error;
      }

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      const { error } = await supabaseDB
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Ensure user owns the notification

      if (error) {
        throw error;
      }

      res.json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let { data: preferences, error } = await supabaseDB
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') { // Not found
        // Create default preferences
        const defaultPrefs = {
          user_id: userId,
          email_enabled: true,
          whatsapp_enabled: false,
          push_enabled: true,
          type_preferences: {
            order_updates: true,
            payment_updates: true,
            delivery_updates: true,
            product_updates: true,
            promotional: false,
            reminders: true,
            system_announcements: true
          },
          quiet_hours_enabled: false
        };

        const { data: newPrefs, error: insertError } = await supabaseDB
          .from('notification_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        preferences = newPrefs;
      } else if (error) {
        throw error;
      }

      res.json(preferences as NotificationPreferences);
    } catch (error) {
      console.error('Error getting preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const updates = req.body;

      const { data: preferences, error } = await supabaseDB
        .from('notification_preferences')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json(preferences as NotificationPreferences);
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default notificationController;