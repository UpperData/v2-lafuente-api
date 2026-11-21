import { models, sequelize } from '../config/database.js';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

const editableFields = [
  'reserveAccountId',
  'targetAmount',
  'currencyMoney',
  'modality',
  'condition',
  'dateLimit',
];
const requiredFields = ['reserveAccountId', 'targetAmount', 'currencyMoney', 'modality'];
const identityFields = ['reserveAccountId', 'currencyMoney', 'modality'];
const supportedCurrencies = ['Dolar', 'Bolivar','Euro'];
const supportedModalities = ['Efectivo', 'Transferencia'];
const supportedConditions = ['Vigente', 'Pausada', 'Cumplida', 'Cancelada'];

function parsePositiveId(value) {
  if (
    (typeof value !== 'string' && typeof value !== 'number')
    || !/^[1-9]\d*$/.test(String(value))
  ) {
    return null;
  }
  const parsedValue = Number(value);
  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

function isPositiveAmount(value) {
  return (
    (typeof value === 'string' || typeof value === 'number')
    && /^\d{1,16}(?:\.\d{1,2})?$/.test(String(value).trim())
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

function validateGoalBody(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El cuerpo de la solicitud debe ser un objeto.' };
  }

  const unsupportedField = Object.keys(body).find(
    (field) => !editableFields.includes(field),
  );
  if (unsupportedField) {
    return { error: `${unsupportedField} no se puede modificar.` };
  }

  const suppliedFields = editableFields.filter((field) => Object.hasOwn(body, field));
  if (suppliedFields.length === 0) {
    return { error: 'Debes proporcionar al menos un campo de la meta.' };
  }

  if (creating) {
    const missingField = requiredFields.find(
      (field) => !Object.hasOwn(body, field) || body[field] === '',
    );
    if (missingField) {
      return { error: `${missingField} es obligatorio.` };
    }
  }

  const updates = {};
  for (const field of suppliedFields) {
    const value = body[field];
    if (field === 'reserveAccountId') {
      const reserveAccountId = parsePositiveId(value);
      if (reserveAccountId === null) {
        return { error: 'reserveAccountId debe ser un entero positivo.' };
      }
      updates.reserveAccountId = reserveAccountId;
    } else if (field === 'targetAmount') {
      if (!isPositiveAmount(value)) {
        return { error: 'targetAmount debe ser un monto mayor que cero con hasta dos decimales.' };
      }
      updates.targetAmount = normalizeAmount(value);
    } else if (field === 'currencyMoney') {
      if (!supportedCurrencies.includes(value)) {
        return { error: 'currencyMoney debe ser Dolar, Bolivar o Euro.' };
      }
      updates.currencyMoney = value;
    } else if (field === 'modality') {
      if (!supportedModalities.includes(value)) {
        return { error: 'modality debe ser Efectivo o Transferencia.' };
      }
      updates.modality = value;
    } else if (field === 'condition') {
      if (!supportedConditions.includes(value)) {
        return { error: 'condition debe ser Vigente, Pausada, Cumplida o Cancelada.' };
      }
      updates.condition = value;
    } else if (field === 'dateLimit') {
      if (value !== null && !isDateOnly(value)) {
        return { error: 'dateLimit debe tener el formato YYYY-MM-DD o ser null.' };
      }
      updates.dateLimit = value;
    }
  }

  return { updates };
}

function parseListFilters(query) {
  const { reserveAccountId, isActived } = query;
  const where = {};

  if (reserveAccountId !== undefined) {
    const parsedId = parsePositiveId(reserveAccountId);
    if (parsedId === null) {
      return { error: 'reserveAccountId debe ser un entero positivo.' };
    }
    where.reserveAccountId = parsedId;
  }

  if (isActived !== undefined) {
    if (!['true', 'false'].includes(isActived)) {
      return { error: 'isActived debe ser true o false.' };
    }
    where.isActived = isActived === 'true';
  }

  return { where };
}

const reserveAccountInclude = {
  model: models.ReserveAccount,
  as: 'reserveAccount',
  attributes: ['id', 'documentId', 'firstName', 'lastName'],
};

export async function listGoals(request, response) {
  const { where, error } = parseListFilters(request.query);
  if (error) {
    return warningResponse(response, error, {}, 400);
  }

  try {
    const goals = await models.Goal.findAll({
      where,
      include: [reserveAccountInclude],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    return successResponse(response, 'Metas listadas correctamente.', goals);
  } catch (error) {
    console.error('Error al listar metas:', error.message);
    return errorResponse(response, 'No fue posible listar las metas.', {}, 500);
  }
}

export async function getGoal(request, response) {
  const goalId = parsePositiveId(request.params.id);
  if (goalId === null) {
    return warningResponse(response, 'El identificador de la meta no es válido.', {}, 400);
  }

  try {
    const goal = await models.Goal.findByPk(goalId, {
      include: [reserveAccountInclude],
    });
    if (!goal) {
      return warningResponse(response, 'La meta indicada no existe.', {}, 404);
    }
    return successResponse(response, 'Meta obtenida correctamente.', goal);
  } catch (error) {
    console.error('Error al obtener meta:', error.message);
    return errorResponse(response, 'No fue posible obtener la meta.', {}, 500);
  }
}

export async function createGoal(request, response) {
  const { updates, error } = validateGoalBody(request.body, { creating: true });
  if (error) {
    return warningResponse(response, error, {}, 400);
  }

  try {
    const result = await sequelize.transaction(async (databaseTransaction) => {
      const reserveAccount = await models.ReserveAccount.findByPk(updates.reserveAccountId, {
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

      return models.Goal.create(updates, { transaction: databaseTransaction });
    });

    if (result.error) {
      return warningResponse(response, result.error, {}, result.statusCode);
    }
    return successResponse(response, 'Meta creada correctamente.', result, 201);
  } catch (error) {
    console.error('Error al crear meta:', error.message);
    return errorResponse(response, 'No fue posible crear la meta.', {}, 500);
  }
}

export async function updateGoal(request, response) {
  const goalId = parsePositiveId(request.params.id);
  if (goalId === null) {
    return warningResponse(response, 'El identificador de la meta no es válido.', {}, 400);
  }

  const { updates, error } = validateGoalBody(request.body);
  if (error) {
    return warningResponse(response, error, {}, 400);
  }

  try {
    const result = await sequelize.transaction(async (databaseTransaction) => {
      let updatedReserveAccount;
      if (Object.hasOwn(updates, 'reserveAccountId')) {
        updatedReserveAccount = await models.ReserveAccount.findByPk(
          updates.reserveAccountId,
          {
            attributes: ['id', 'isActived'],
            transaction: databaseTransaction,
            lock: databaseTransaction.LOCK.UPDATE,
          },
        );
        if (!updatedReserveAccount) {
          return { error: 'La cuenta de reserva indicada no existe.', statusCode: 404 };
        }
      }

      const goal = await models.Goal.findByPk(goalId, {
        transaction: databaseTransaction,
        lock: databaseTransaction.LOCK.UPDATE,
      });
      if (!goal) {
        return { error: 'La meta indicada no existe.', statusCode: 404 };
      }

      const changesIdentity = identityFields.some(
        (field) => Object.hasOwn(updates, field) && updates[field] !== goal[field],
      );
      if (changesIdentity) {
        const transactionCount = await models.Transaction.count({
          where: { goalId: goal.id },
          transaction: databaseTransaction,
        });
        if (transactionCount > 0) {
          return {
            error: 'No se puede cambiar la cuenta, moneda o modalidad de una meta con transacciones asociadas.',
            statusCode: 409,
          };
        }
      }

      if (
        updatedReserveAccount
        && updatedReserveAccount.id !== goal.reserveAccountId
        && !updatedReserveAccount.isActived
      ) {
        return { error: 'La cuenta de reserva está desactivada.', statusCode: 400 };
      }

      await goal.update(updates, { transaction: databaseTransaction });
      return goal;
    });

    if (result.error) {
      return warningResponse(response, result.error, {}, result.statusCode);
    }
    return successResponse(response, 'Meta actualizada correctamente.', result);
  } catch (error) {
    console.error('Error al actualizar meta:', error.message);
    return errorResponse(response, 'No fue posible actualizar la meta.', {}, 500);
  }
}

export async function setGoalActivation(request, response) {
  const goalId = parsePositiveId(request.params.id);
  if (goalId === null) {
    return warningResponse(response, 'El identificador de la meta no es válido.', {}, 400);
  }

  if (
    !request.body
    || typeof request.body !== 'object'
    || Array.isArray(request.body)
    || !Object.hasOwn(request.body, 'isActived')
    || Object.keys(request.body).length !== 1
  ) {
    return warningResponse(
      response,
      'El cuerpo debe contener únicamente el campo isActived.',
      {},
      400,
    );
  }

  const { isActived } = request.body;
  if (typeof isActived !== 'boolean') {
    return warningResponse(response, 'isActived debe ser un valor booleano.', {}, 400);
  }

  try {
    const goal = await models.Goal.findByPk(goalId);
    if (!goal) {
      return warningResponse(response, 'La meta indicada no existe.', {}, 404);
    }

    await goal.update({ isActived });
    return successResponse(
      response,
      `Meta ${isActived ? 'activada' : 'desactivada'} correctamente.`,
      goal,
    );
  } catch (error) {
    console.error('Error al cambiar activación de meta:', error.message);
    return errorResponse(response, 'No fue posible cambiar la activación de la meta.', {}, 500);
  }
}