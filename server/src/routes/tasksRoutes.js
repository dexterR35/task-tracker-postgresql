import express from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
} from '../controllers/tasksController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getTasks);
router.get('/:id', authenticateToken, getTaskById);
router.post('/', authenticateToken, requirePermission('create_tasks'), createTask);
router.put('/:id', authenticateToken, requirePermission('update_tasks'), updateTask);
router.delete('/:id', authenticateToken, requirePermission('delete_tasks'), deleteTask);

export default router;

