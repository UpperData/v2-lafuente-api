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
