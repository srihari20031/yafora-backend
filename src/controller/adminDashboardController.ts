import { Request, Response } from 'express';
import * as AdminDashboardService from '../services/adminDashboardService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
  };
}

export async function getDashboardOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { timeframe } = req.query;
    const overview = await AdminDashboardService.getDashboardOverview(timeframe as string || '30d');
    res.status(200).json(overview);
  } catch (error) {
    console.error('Error fetching dashboard overview:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getUserAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { period, days } = req.query;
    const analytics = await AdminDashboardService.getUserAnalytics(period as string || 'daily', parseInt(days as string) || 30);
    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching user analytics:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getOrderAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { period, days } = req.query;
    const analytics = await AdminDashboardService.getOrderAnalytics(period as string || 'daily', parseInt(days as string) || 30);
    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching order analytics:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getRevenueAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { period, days } = req.query;
    const analytics = await AdminDashboardService.getRevenueAnalytics(period as string || 'daily', parseInt(days as string) || 30);
    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching revenue analytics:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getProductAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { limit, timeframe, sortBy } = req.query;
    const analytics = await AdminDashboardService.getProductAnalytics(
      parseInt(limit as string) || 10,
      timeframe as string || '30d',
      sortBy as string || 'revenue'
    );
    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching product analytics:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getActiveUsersBreakdown(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { timeframe } = req.query;
    const breakdown = await AdminDashboardService.getActiveUsersBreakdown(timeframe as string || '30d');
    res.status(200).json(breakdown);
  } catch (error) {
    console.error('Error fetching active users breakdown:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getRealTimeData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await AdminDashboardService.getRealTimeData();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching real-time data:', (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
}