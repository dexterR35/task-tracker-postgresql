import express from 'express';
import authRoutes from './authRoutes.js';
import usersRoutes from './usersRoutes.js';
import tasksRoutes from './tasksRoutes.js';
import monthsRoutes from './monthsRoutes.js';
import reportersRoutes from './reportersRoutes.js';
import deliverablesRoutes from './deliverablesRoutes.js';
import teamDaysOffRoutes from './teamDaysOffRoutes.js';
import teamsRoutes from './teamsRoutes.js';
import yearsRoutes from './yearsRoutes.js';
import marketsRoutes from './marketsRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/tasks', tasksRoutes);
router.use('/months', monthsRoutes);
router.use('/reporters', reportersRoutes);
router.use('/deliverables', deliverablesRoutes);
router.use('/team-days-off', teamDaysOffRoutes);
router.use('/teams', teamsRoutes);
router.use('/years', yearsRoutes);
router.use('/markets', marketsRoutes);

export default router;

