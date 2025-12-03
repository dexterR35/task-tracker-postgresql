import express from 'express';
import {
  getReporters,
  getReporterById,
  createReporter,
  updateReporter,
  deleteReporter
} from '../controllers/reportersController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getReporters);
router.get('/:id', authenticateToken, getReporterById);
router.post('/', authenticateToken, requirePermission('manage_reporters'), createReporter);
router.put('/:id', authenticateToken, requirePermission('manage_reporters'), updateReporter);
router.delete('/:id', authenticateToken, requirePermission('manage_reporters'), deleteReporter);

export default router;

