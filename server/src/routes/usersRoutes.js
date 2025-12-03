import express from 'express';
import {
  getUsers,
  getUserById,
  getUserByUID,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/usersController.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, requireRole('admin'), getUsers);
router.get('/:id', authenticateToken, getUserById);
router.get('/uid/:uid', authenticateToken, getUserByUID);
router.post('/', authenticateToken, requireRole('admin'), createUser);
router.put('/:id', authenticateToken, requireRole('admin'), updateUser);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteUser);

export default router;

