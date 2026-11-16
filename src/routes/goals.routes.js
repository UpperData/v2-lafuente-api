import { Router } from 'express';
import {
  createGoal,
  getGoal,
  listGoals,
  setGoalActivation,
  updateGoal,
} from '../controllers/goal.ctrl.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const goalsRouter = Router();

goalsRouter.get('/', requireAuth, listGoals);
goalsRouter.get('/:id', requireAuth, getGoal);
goalsRouter.post('/', requireAdmin, createGoal);
goalsRouter.put('/:id', requireAdmin, updateGoal);
goalsRouter.patch('/:id/activation', requireAdmin, setGoalActivation);

export default goalsRouter;
