import express from 'express';
import {
  getTeamDaysOff,
  getDayOffById,
  createDayOff,
  updateDayOff,
  deleteDayOff
} from '../controllers/teamDaysOffController.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET: Users can view their own, admins can view all
router.get('/', authenticateToken, getTeamDaysOff);
router.get('/:id', authenticateToken, getDayOffById);
// POST/PUT/DELETE: Only admins or users with permission can manage
router.post('/', authenticateToken, requirePermission('manage_team_days_off'), createDayOff);
router.put('/:id', authenticateToken, requirePermission('manage_team_days_off'), updateDayOff);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteDayOff);

export default router;

