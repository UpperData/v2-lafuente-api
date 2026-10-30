import { Router } from 'express';
import { listClients } from '../controllers/reserveAccounts.ctrl.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const reserveAccountsRouter = Router();

reserveAccountsRouter.get('/', requireAuth, listClients);

export default reserveAccountsRouter;
