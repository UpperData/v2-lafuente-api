import { Op } from 'sequelize';
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

function parseTransactionFile(value) {
  if (value === undefined || value === null || value === '') {
    return { file: undefined };
  }

  let file;
  if (Buffer.isBuffer(value)) {
    file = value;
  } else if (
    value
    && typeof value === 'object'
    && value.type === 'Buffer'
    && Array.isArray(value.data)
  ) {
    if (value.data.length > 8 * 1024 * 1024) {
      return { error: 'El comprobante no puede superar los 8 MB.', statusCode: 413 };
    }
    if (!value.data.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      return { error: 'file.data debe contener bytes enteros entre 0 y 255.' };
    }
    file = Buffer.from(value.data);
  } else if (typeof value === 'string' && /^\\x/i.test(value)) {
    const hex = value.slice(2);
    if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) {
      return { error: 'file no contiene una representación hexadecimal bytea válida.' };
    }
    file = Buffer.from(hex, 'hex');
  } else if (typeof value === 'string') {
    const dataUrlMatch = value.match(/^data:[^;,]+;base64,([\s\S]*)$/i);
    const base64 = (dataUrlMatch ? dataUrlMatch[1] : value).replace(/\s/g, '');
    if (
      !base64
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
      || base64.length % 4 === 1
    ) {
      return { error: 'file debe contener bytea hexadecimal, Base64 o una URL de datos Base64.' };
    }

    file = Buffer.from(base64, 'base64');
    if (file.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
      return { error: 'file no contiene una cadena Base64 válida.' };
    }
  } else {
    return {
      error: 'file debe contener bytea hexadecimal, Base64 o un objeto Buffer serializado.',
    };
  }

  if (file.length > 8 * 1024 * 1024) {
    return { error: 'El comprobante no puede superar los 8 MB.', statusCode: 413 };
  }

  return { file };
}

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parsePositiveInteger(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsedValue = Number(value);
  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

export async function listTransactions(request, response) {
  const {
    type,
    isActived,
    operator,
    operatorId,
    createdAtFrom,
    createdAtTo,
    page: pageParam = '1',
    limit: limitParam = '50',
  } = request.query;

  const reserveAccountId = request.params.reserveAccountId;
  const clientIdValue = parsePositiveInteger(reserveAccountId);
  if (clientIdValue === null) {
    return warningResponse(response, 'reserveAccountId debe ser un entero positivo.', {}, 400);
  }

  if (type !== undefined && !['input', 'output'].includes(type)) {
    return warningResponse(response, 'type debe ser input o output.', {}, 400);
  }

  if (isActived !== undefined && !['true', 'false'].includes(isActived)) {
    return warningResponse(response, 'isActived debe ser true o false.', {}, 400);
  }

  if (operator !== undefined && operatorId !== undefined && operator !== operatorId) {
    return warningResponse(response, 'operator y operatorId no pueden tener valores distintos.', {}, 400);
  }

  const operatorValue = operator ?? operatorId;
  const operatorIdValue = operatorValue === undefined
    ? undefined
    : parsePositiveInteger(operatorValue);
  if (operatorValue !== undefined && operatorIdValue === null) {
    return warningResponse(response, 'operator debe ser un entero positivo.', {}, 400);
  }

  if (createdAtFrom !== undefined && !isDateOnly(createdAtFrom)) {
    return warningResponse(response, 'createdAtFrom debe tener el formato YYYY-MM-DD.', {}, 400);
  }
  if (createdAtTo !== undefined && !isDateOnly(createdAtTo)) {
    return warningResponse(response, 'createdAtTo debe tener el formato YYYY-MM-DD.', {}, 400);
  }
  if (
    createdAtFrom !== undefined
    && createdAtTo !== undefined
    && createdAtFrom > createdAtTo
  ) {
    return warningResponse(response, 'createdAtFrom no puede ser posterior a createdAtTo.', {}, 400);
  }

  const page = parsePositiveInteger(pageParam);
  if (page === null) {
    return warningResponse(response, 'page debe ser un entero positivo.', {}, 400);
  }
  const limit = parsePositiveInteger(limitParam);
  if (limit === null || limit > 100) {
    return warningResponse(response, 'limit debe ser un entero entre 1 y 100.', {}, 400);
  }
  if ((page - 1) * limit > Number.MAX_SAFE_INTEGER) {
    return warningResponse(response, 'page está fuera del rango permitido.', {}, 400);
  }

  const where = {};
  if (type !== undefined) where.type = type;
  if (isActived !== undefined) where.isActived = isActived === 'true';
  where.reserveAccountId = clientIdValue;
  if (operatorIdValue !== undefined) where.operatorId = operatorIdValue;
  if (createdAtFrom !== undefined || createdAtTo !== undefined) {
    where.createdAt = {};
    if (createdAtFrom !== undefined) {
      where.createdAt[Op.gte] = new Date(`${createdAtFrom}T00:00:00.000Z`);
    }
    if (createdAtTo !== undefined) {
      where.createdAt[Op.lte] = new Date(`${createdAtTo}T23:59:59.999Z`);
    }
  }

  try {
    const { count, rows } = await models.Transaction.findAndCountAll({
      attributes: [
        'id',
        'amountNeto',
        'amountBrute',
        'reserveAccountId',
        'type',
        'currencyMoney',
        'payData',
        'reference',
        'isPayConfirmed',
        'operatorId',
        'comissions',
        'isActived',
        'note',
        'isComissionInMount',
        'payDate',
        'createdAt',
        'updatedAt',
      ],
      where,
      include: [
        {
          model: models.ReserveAccount,
          as: 'reserveAccount',
          attributes: ['id', 'documentId', 'firstName', 'lastName'],
        },
        {
          model: models.Account,
          as: 'operator',
          attributes: ['id', 'email'],
        },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return successResponse(response, 'Transacciones listadas correctamente.', {
      transactions: rows,
      total: count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error al listar transacciones:', error.message);
    return errorResponse(response, 'No fue posible listar las transacciones.', {}, 500);
  }
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

  const parsedFile = parseTransactionFile(body.file);
  if (parsedFile.error) {
    return warningResponse(
      response,
      parsedFile.error,
      {},
      parsedFile.statusCode ?? 400,
    );
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
    if (parsedFile.file !== undefined) {
      transactionData.file = parsedFile.file;
    } else if (body.file === null) {
      transactionData.file = null;
    }

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
