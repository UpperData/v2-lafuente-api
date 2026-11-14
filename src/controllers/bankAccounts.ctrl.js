import { models } from '../config/database.js';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

export async function listBankAccounts(request, response) {
  const { isActived } = request.query;

  if (
    isActived !== undefined
    && isActived !== '*'
    && isActived !== 'true'
    && isActived !== 'false'
  ) {
    return warningResponse(response, 'isActived debe ser true, false o *.', {}, 400);
  }

  try {
    const bankAccounts = await models.BankAccount.findAll({
      attributes: [
        'id',
        'accountNumber',
        'holder',
        'bankId',
        'method',
        'isActived',
        'createdAt',
        'updatedAt',
        'currencyMoney',
      ],
      include: [{
        model: models.Bank,
        as: 'bank',
        attributes: ['id', 'name'],
      }],
      order: [['id', 'ASC']],
      where: isActived === undefined || isActived === '*'
        ? {}
        : { isActived: isActived === 'true' },
    });
    // en lugar de bank (), retorna bankId y bankName
    bankAccounts.forEach((account) => {
      account.dataValues.bankId = account.dataValues.bank.id;
      account.dataValues.bankName = account.dataValues.bank.name;
      delete account.dataValues.bank;
    });

    return successResponse(response, 'Cuentas bancarias listadas correctamente.', bankAccounts);
  } catch (error) {
    console.error('Error al listar cuentas bancarias:', error.message);
    return errorResponse(response, 'No fue posible listar las cuentas bancarias.', {}, 500);
  }
}
