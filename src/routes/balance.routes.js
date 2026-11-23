import { Router } from 'express';
import { getGlobalBalance } from '../controllers/balance.ctrl.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const balanceRouter = Router();

balanceRouter.get('/', requireAuth, getGlobalBalance);

export default balanceRouter;
