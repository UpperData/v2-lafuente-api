import { Router } from 'express';
import { changeStatus, createUser, listUsers, roleList, updateUser } from '../controllers/admin.ctrl.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

const userRouter = Router();

userRouter.post('/', requireAdmin, createUser);
userRouter.get('/', requireAdmin, listUsers);
userRouter.put('/:id', requireAdmin, updateUser);
userRouter.patch('/:id/status', requireAdmin, changeStatus);
userRouter.get('/roles', requireAdmin, roleList);

export default userRouter;