import { Router } from 'express';
import {
  listTransactions,
  registerTransaction,
} from '../controllers/transactions.ctrl.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const transactionsRouter = Router();

transactionsRouter.get('/:reserveAccountId', requireAuth, listTransactions);
transactionsRouter.post('/', requireAuth, registerTransaction);

export default transactionsRouter;
