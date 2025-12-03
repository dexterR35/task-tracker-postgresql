import express from 'express';
import {
  getTeamDaysOff,
  getDayOffById,
  createDayOff,
  updateDayOff,
  deleteDayOff
} from '../controllers/teamDaysOffController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getTeamDaysOff);
router.get('/:id', authenticateToken, getDayOffById);
router.post('/', authenticateToken, createDayOff);
router.put('/:id', authenticateToken, updateDayOff);
router.delete('/:id', authenticateToken, deleteDayOff);

export default router;

