import express from 'express';
import {
  getDeliverables,
  getDeliverableById,
  createDeliverable,
  updateDeliverable,
  deleteDeliverable
} from '../controllers/deliverablesController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getDeliverables);
router.get('/:id', authenticateToken, getDeliverableById);
router.post('/', authenticateToken, requirePermission('manage_deliverables'), createDeliverable);
router.put('/:id', authenticateToken, requirePermission('manage_deliverables'), updateDeliverable);
router.delete('/:id', authenticateToken, requirePermission('manage_deliverables'), deleteDeliverable);

export default router;

