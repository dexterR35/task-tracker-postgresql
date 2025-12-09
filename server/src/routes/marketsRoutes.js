import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  getMarkets,
  getMarketById,
  getMarketByCode,
  createMarket,
  updateMarket,
  deleteMarket,
  getMarketTasks
} from '../controllers/marketsController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET routes
router.get('/', getMarkets);
router.get('/code/:code', getMarketByCode);
router.get('/:id', getMarketById);
router.get('/:id/tasks', getMarketTasks);

// POST routes (admin only)
router.post('/', requireRole('admin'), createMarket);

// PUT routes (admin only)
router.put('/:id', requireRole('admin'), updateMarket);

// DELETE routes (admin only)
router.delete('/:id', requireRole('admin'), deleteMarket);

export default router;

