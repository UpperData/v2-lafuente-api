import { models, sequelize } from '../config/database.js';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

const transactionFields = [
  'amountNeto',
  'amountBrute',
  'reserveAccountId',
  'type',
  'currencyMoney',
  'payData',
  'reference',
  'comissions',
  'note',
  'isComissionInMount',
  'payDate',
];

function isPositiveAmount(value) {
  return (
    (typeof value === 'number' || typeof value === 'string')
    && /^\d{1,8}(?:\.\d{1,2})?$/.test(String(value).trim())
    && Number(value) > 0
  );
}

function normalizeAmount(value) {
  const [whole, fraction = ''] = String(value).trim().split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export async function registerTransaction(request, response) {
  const body = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return warningResponse(response, 'El cuerpo de la solicitud debe ser un objeto.', {}, 400);
  }

  const requiredFields = [
    'amountNeto',
    'amountBrute',
    'reserveAccountId',
    'type',
    'currencyMoney',
  ];
  const missingField = requiredFields.find(
    (field) => !Object.hasOwn(body, field) || body[field] === '',
  );
  if (missingField) {
    return warningResponse(response, `${missingField} es obligatorio.`, {}, 400);
  }

  if (!isPositiveAmount(body.amountNeto) || !isPositiveAmount(body.amountBrute)) {
    return warningResponse(response, 'amountNeto y amountBrute deben ser importes mayores que cero.', {}, 400);
  }

  const reserveAccountId = Number(body.reserveAccountId);
  if (!Number.isInteger(reserveAccountId) || reserveAccountId < 1) {
    return warningResponse(response, 'reserveAccountId debe ser un entero válido.', {}, 400);
  }

  if (!['input', 'output'].includes(body.type)) {
    return warningResponse(response, 'type debe ser input o output.', {}, 400);
  }

  if (!['Dolar', 'Bolivar'].includes(body.currencyMoney)) {
    return warningResponse(response, 'currencyMoney debe ser Dolar o Bolivar.', {}, 400);
  }

  if (
    Object.hasOwn(body, 'isComissionInMount')
    && typeof body.isComissionInMount !== 'boolean'
  ) {
    return warningResponse(response, 'isComissionInMount debe ser un valor booleano.', {}, 400);
  }

  for (const field of ['reference', 'note']) {
    if (
      Object.hasOwn(body, field)
      && body[field] !== null
      && typeof body[field] !== 'string'
    ) {
      return warningResponse(response, `${field} debe ser un texto.`, {}, 400);
    }
  }

  if (Object.hasOwn(body, 'reference') && body.reference?.length > 50) {
    return warningResponse(response, 'reference no puede superar 50 caracteres.', {}, 400);
  }
  if (Object.hasOwn(body, 'note') && body.note?.length > 250) {
    return warningResponse(response, 'note no puede superar 250 caracteres.', {}, 400);
  }

  if (
    Object.hasOwn(body, 'payData')
    && body.payData !== null
    && (typeof body.payData !== 'object' || Array.isArray(body.payData))
  ) {
    return warningResponse(response, 'payData debe ser un objeto.', {}, 400);
  }

  if (
    !body.payData
    || typeof body.payData.method !== 'string'
    || !body.payData.method.trim()
  ) {
    return warningResponse(
      response,
      'payData.method es obligatorio para identificar el saldo de efectivo o transferencia.',
      {},
      400,
    );
  }

  if (
    Object.hasOwn(body, 'comissions')
    && body.comissions !== null
    && typeof body.comissions !== 'object'
  ) {
    return warningResponse(response, 'comissions debe ser un objeto o arreglo.', {}, 400);
  }

  if (Object.hasOwn(body, 'payDate') && body.payDate !== null && !isDateOnly(body.payDate)) {
    return warningResponse(response, 'payDate debe tener el formato YYYY-MM-DD.', {}, 400);
  }

  try {
    const transactionData = Object.fromEntries(
      transactionFields
        .filter((field) => Object.hasOwn(body, field))
        .map((field) => [field, body[field]]),
    );
    transactionData.amountNeto = normalizeAmount(body.amountNeto);
    transactionData.amountBrute = normalizeAmount(body.amountBrute);
    transactionData.operatorId = request.auth.accountId;

    const result = await sequelize.transaction(async (databaseTransaction) => {
      const reserveAccount = await models.ReserveAccount.findByPk(reserveAccountId, {
        attributes: ['id', 'isActived'],
        transaction: databaseTransaction,
        lock: databaseTransaction.LOCK.UPDATE,
      });
      if (!reserveAccount) {
        return { error: 'La cuenta de reserva indicada no existe.', statusCode: 404 };
      }
      if (!reserveAccount.isActived) {
        return { error: 'La cuenta de reserva está desactivada.', statusCode: 400 };
      }

      transactionData.reserveAccountId = reserveAccount.id;
      const transaction = await models.Transaction.create(transactionData, {
        transaction: databaseTransaction,
      });
      return transaction;
    });

    if (result.error) {
      return warningResponse(response, result.error, {}, result.statusCode);
    }

    return successResponse(
      response,
      'Transacción registrada correctamente.',
      result,
      201,
    );
  } catch (error) {
    console.log(error);
    console.error('Error al registrar transacción:', error.message);
    return errorResponse(response, 'No fue posible registrar la transacción.', {}, 500);
  }
}
