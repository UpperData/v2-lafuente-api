import { Router } from 'express';
import { recognizeDollarBills } from '../controllers/cash.ctrl.js';
import { parseImageUpload } from '../middlewares/parseImageUpload.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const cashRouter = Router();

cashRouter.post('/analyze', requireAuth, parseImageUpload, recognizeDollarBills);

export default cashRouter;
