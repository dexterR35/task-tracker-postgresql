import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamDepartments
} from '../controllers/teamsController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET routes
router.get('/', getTeams);
router.get('/:id', getTeamById);
router.get('/:id/departments', getTeamDepartments);

// POST routes (admin only)
router.post('/', requireRole('admin'), createTeam);

// PUT routes (admin only)
router.put('/:id', requireRole('admin'), updateTeam);

// DELETE routes (admin only)
router.delete('/:id', requireRole('admin'), deleteTeam);

export default router;

