import { Router } from 'express';
import {
  createBank,
  deleteBank,
  getBank,
  listBanks,
  updateBank,
} from '../controllers/bank.ctrl.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

const banksRouter = Router();

banksRouter.get('/', requireAdmin, listBanks);
banksRouter.get('/:id', requireAdmin, getBank);
banksRouter.post('/', requireAdmin, createBank);
banksRouter.put('/:id', requireAdmin, updateBank);
banksRouter.delete('/:id', requireAdmin, deleteBank);

export default banksRouter;
