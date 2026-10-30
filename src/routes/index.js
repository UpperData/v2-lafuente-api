import { Router } from 'express';
import authRouter from './auth.routes.js';
import userRouter from './admin.routes.js';
import bankAccountsRouter from './bankAccounts.routes.js';
import reserveAccountsRouter from './reserveAccounts.routes.js';
import cashRouter from './cash.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/bank-accounts', bankAccountsRouter);
router.use('/clients', reserveAccountsRouter);
router.use('/cash', cashRouter);

export default router;
