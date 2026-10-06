import { Router } from 'express';
import { login } from '../controllers/auth.ctrl.js';

const authRouter = Router();

authRouter.post('/login', login);

export default authRouter;