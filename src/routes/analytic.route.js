import { Router } from 'express';
import { getIncomingTransactions } from '../controllers/analytic.ctrl.js';

const router = Router();

router.get('/incoming-transactions', getIncomingTransactions);

export default router;