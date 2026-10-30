import { Router } from 'express';
import { listBankAccounts } from '../controllers/bankAccounts.ctrl.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

const bankAccountsRouter = Router();

bankAccountsRouter.get('/', requireAdmin, listBankAccounts);

export default bankAccountsRouter;
