import { Router } from 'express';
import authRouter from './auth.routes.js';
import userRouter from './admin.routes.js';
import bankAccountsRouter from './bankAccounts.routes.js';
import reserveAccountsRouter from './reserveAccounts.routes.js';
import cashRouter from './cash.routes.js';
import transactionsRouter from './transactions.routes.js';
import goalsRouter from './goals.routes.js';
import banksRouter from './banks.routes.js';
import analyticRouter from './analytic.route.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/analytic', analyticRouter);
router.use('/bank-accounts', bankAccountsRouter);
router.use('/clients', reserveAccountsRouter);
router.use('/cash', cashRouter);
router.use('/transactions', transactionsRouter);
router.use('/goals', goalsRouter);
router.use('/banks', banksRouter);

export default router;
