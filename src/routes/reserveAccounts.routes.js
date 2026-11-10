import { Router } from 'express';
import {
  addClient,
  editClient,
  listClients,
} from '../controllers/reserveAccounts.ctrl.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const reserveAccountsRouter = Router();

reserveAccountsRouter.get('/', requireAuth, listClients);
reserveAccountsRouter.post('/', requireAdmin, addClient);
reserveAccountsRouter.put('/:id', requireAdmin, editClient);

export default reserveAccountsRouter;
