import { Router } from 'express';
import { registerTransaction } from '../controllers/transactions.ctrl.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const transactionsRouter = Router();

transactionsRouter.post('/', requireAuth, registerTransaction);

export default transactionsRouter;
