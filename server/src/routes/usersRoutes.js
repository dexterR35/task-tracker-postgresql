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
import { validate } from '../middleware/validateRequest.js';
import { schemas } from '../middleware/validateRequest.js';

const router = express.Router();

router.get('/', authenticateToken, requireRole('admin'), getUsers);
// Users can only view their own profile, admins can view any
router.get('/:id', authenticateToken, getUserById);
// Keep /uid/:uid route for backward compatibility (now uses same logic as /:id)
router.get('/uid/:uid', authenticateToken, getUserByUID);
router.post('/', authenticateToken, requireRole('admin'), validate(schemas.createUser), createUser);
router.put('/:id', authenticateToken, requireRole('admin'), validate(schemas.updateUser), updateUser);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteUser);

export default router;

