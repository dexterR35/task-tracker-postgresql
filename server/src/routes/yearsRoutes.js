import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  getYears,
  getYearById,
  createYear,
  updateYear,
  deleteYear,
  getYearMonths,
  getOrCreateYear
} from '../controllers/yearsController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET routes
router.get('/', getYears);
router.get('/:id', getYearById);
router.get('/:id/months', getYearMonths);

// POST routes
router.post('/', requireRole('admin'), createYear);
router.post('/get-or-create', getOrCreateYear); // Both user and admin can trigger this

// PUT routes (admin only)
router.put('/:id', requireRole('admin'), updateYear);

// DELETE routes (admin only)
router.delete('/:id', requireRole('admin'), deleteYear);

export default router;

