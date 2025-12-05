import express from 'express';
import { login, verifyToken } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validateRequest.js';
import { schemas } from '../middleware/validateRequest.js';

const router = express.Router();

// Use validation middleware for login
router.post('/login', validate(schemas.login), login);
router.get('/verify', authenticateToken, verifyToken);

export default router;

