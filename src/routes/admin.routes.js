import { Router } from 'express';
import { createUser } from '../controllers/admin.ctrl.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

const userRouter = Router();

userRouter.post('/', requireAdmin, createUser);

export default userRouter;