import express from 'express';
import {
  getMonths,
  getMonthById,
  createMonth,
  updateMonth
} from '../controllers/monthsController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getMonths);
router.get('/:monthId', authenticateToken, getMonthById);
router.post('/', authenticateToken, requirePermission('create_boards'), createMonth);
router.put('/:monthId', authenticateToken, updateMonth);

export default router;

