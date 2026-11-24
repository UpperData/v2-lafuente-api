import { Router } from 'express';
import { accountBalance, getGlobalBalance } from '../controllers/balance.ctrl.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const balanceRouter = Router();

balanceRouter.get('/', requireAuth, getGlobalBalance);
balanceRouter.get('/accounts', requireAuth, accountBalance);

export default balanceRouter;
