import { Op } from 'sequelize';
import { models } from '../config/database.js';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

const validCurrencies = ['Dolar', 'Bolivar', 'Euro'];

export async function getGlobalBalance(request, response) {
  const { currencyMoney } = request.query ?? {};

  if (currencyMoney !== undefined && !validCurrencies.includes(currencyMoney)) {
    return warningResponse(
      response,
      'currencyMoney debe ser Dolar, Bolivar o Euro.',
      {},
      400,
    );
  }

  try {
    const where = currencyMoney !== undefined ? { currencyMoney } : {};
    const balances = await models.GlobalBalance.findAll({
      attributes: [
        'id',
        'currencyMoney',
        'currentBalanceCash',
        'currentBalanceTransfer',        
        'updatedAt',
      ],
      where,
      order: [['id', 'ASC']],
    });

    return successResponse(response, 'Saldo global obtenido correctamente.', balances);
  } catch (error) {
    console.error('Error al obtener el saldo global:', error.message);
    return errorResponse(response, 'No fue posible obtener el saldo global.', {}, 500);
  }
}

export async function accountBalance(request, response) {
  const { currencyMoney } = request.query ?? {};

  if (currencyMoney !== undefined && !validCurrencies.includes(currencyMoney)) {
    return warningResponse(
      response,
      'currencyMoney debe ser Dolar, Bolivar o Euro.',
      {},
      400,
    );
  }

  try {
    const where = {
      balance: { [Op.lt]: 0 },
      ...(currencyMoney !== undefined ? { currencyMoney } : {}),
    };

    const accounts = await models.BankAccount.findAll({
      attributes: ['holder', 'balance', 'currencyMoney', 'method'],
      include: [{
        model: models.Bank,
        as: 'bank',
        attributes: ['name'],
      }],
      where,
      order: [['balance', 'ASC'], ['id', 'ASC']],
    });

    const data = accounts.map((account) => ({
      holder: account.holder,
      balance: account.balance,
      currencyMoney: account.currencyMoney,
      method: account.method,
      bankName: account.bank?.name ?? null,
    }));

    return successResponse(
      response,
      'Cuentas con balance negativo obtenidas correctamente.',
      data,
    );
  } catch (error) {
    console.error('Error al obtener las cuentas con balance negativo:', error.message);
    return errorResponse(
      response,
      'No fue posible obtener las cuentas con balance negativo.',
      {},
      500,
    );
  }
}
