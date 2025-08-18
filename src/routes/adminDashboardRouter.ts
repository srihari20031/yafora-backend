import express from 'express';
import * as AdminDashboardController from '../controller/adminDashboardController';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddlware';

const router = express.Router();

// Dashboard overview routes
router.get('/overview', authMiddleware, adminMiddleware, AdminDashboardController.getDashboardOverview);

// Analytics routes
router.get('/analytics/users', authMiddleware, adminMiddleware, AdminDashboardController.getUserAnalytics);
router.get('/analytics/orders', authMiddleware, adminMiddleware, AdminDashboardController.getOrderAnalytics);
router.get('/analytics/revenue', authMiddleware, adminMiddleware, AdminDashboardController.getRevenueAnalytics);
router.get('/analytics/products', authMiddleware, adminMiddleware, AdminDashboardController.getProductAnalytics);

// Active users breakdown
router.get('/analytics/active-users', authMiddleware, adminMiddleware, AdminDashboardController.getActiveUsersBreakdown);

// Real-time data
router.get('/realtime', authMiddleware, adminMiddleware, AdminDashboardController.getRealTimeData);

export default router;