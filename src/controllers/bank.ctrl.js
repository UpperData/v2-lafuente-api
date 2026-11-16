import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { models } from '../config/database.js';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

const editableFields = ['name', 'code', 'isActived'];

function parseBankId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsedValue = Number(value);
  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

function validateBankBody(body, { creating = false } = {}) {
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
    return { error: 'Debes proporcionar al menos un campo del banco.' };
  }
  if (creating && (typeof body.name !== 'string' || !body.name.trim())) {
    return { error: 'name es obligatorio.' };
  }

  const updates = {};
  for (const field of suppliedFields) {
    const value = body[field];
    if (field === 'name') {
      if (typeof value !== 'string' || !value.trim()) {
        return { error: 'name debe ser un texto no vacío.' };
      }
      if (value.trim().length > 60) {
        return { error: 'name no puede superar 60 caracteres.' };
      }
      updates.name = value.trim();
    } else if (field === 'code') {
      if (value !== null && (typeof value !== 'string' || !value.trim())) {
        return { error: 'code debe ser un texto no vacío o null.' };
      }
      if (typeof value === 'string' && value.trim().length > 30) {
        return { error: 'code no puede superar 30 caracteres.' };
      }
      updates.code = typeof value === 'string' ? value.trim() : null;
    } else if (field === 'isActived') {
      if (typeof value !== 'boolean') {
        return { error: 'isActived debe ser un valor booleano.' };
      }
      updates.isActived = value;
    }
  }

  return { updates };
}

function handleBankError(error, response, action) {
  if (error instanceof UniqueConstraintError) {
    return warningResponse(response, 'Ya existe un banco con ese nombre.', {}, 409);
  }
  if (error instanceof ForeignKeyConstraintError) {
    return warningResponse(
      response,
      'No se puede eliminar el banco porque tiene cuentas bancarias asociadas.',
      {},
      409,
    );
  }
  console.error(`Error al ${action} banco:`, error.message);
  return errorResponse(response, `No fue posible ${action} el banco.`, {}, 500);
}

export async function listBanks(request, response) {
  const { isActived } = request.query;
  if (
    isActived !== undefined
    && !['true', 'false', '*'].includes(isActived)
  ) {
    return warningResponse(response, 'isActived debe ser true, false o *.', {}, 400);
  }

  try {
    const banks = await models.Bank.findAll({
      attributes: ['id', 'name', 'code', 'isActived', 'createdAt', 'updatedAt'],
      where: isActived === undefined || isActived === '*'
        ? {}
        : { isActived: isActived === 'true' },
      order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return successResponse(response, 'Bancos listados correctamente.', banks);
  } catch (error) {
    return handleBankError(error, response, 'listar');
  }
}

export async function getBank(request, response) {
  const bankId = parseBankId(request.params.id);
  if (bankId === null) {
    return warningResponse(response, 'El identificador del banco no es válido.', {}, 400);
  }

  try {
    const bank = await models.Bank.findByPk(bankId, {
      attributes: ['id', 'name', 'code', 'isActived', 'createdAt', 'updatedAt'],
    });
    if (!bank) {
      return warningResponse(response, 'El banco indicado no existe.', {}, 404);
    }
    return successResponse(response, 'Banco obtenido correctamente.', bank);
  } catch (error) {
    return handleBankError(error, response, 'obtener');
  }
}

export async function createBank(request, response) {
  const { updates, error } = validateBankBody(request.body, { creating: true });
  if (error) {
    return warningResponse(response, error, {}, 400);
  }

  try {
    const bank = await models.Bank.create(updates);
    return successResponse(response, 'Banco creado correctamente.', bank, 201);
  } catch (error) {
    return handleBankError(error, response, 'crear');
  }
}

export async function updateBank(request, response) {
  const bankId = parseBankId(request.params.id);
  if (bankId === null) {
    return warningResponse(response, 'El identificador del banco no es válido.', {}, 400);
  }

  const { updates, error } = validateBankBody(request.body);
  if (error) {
    return warningResponse(response, error, {}, 400);
  }

  try {
    const bank = await models.Bank.findByPk(bankId);
    if (!bank) {
      return warningResponse(response, 'El banco indicado no existe.', {}, 404);
    }
    await bank.update(updates);
    return successResponse(response, 'Banco actualizado correctamente.', bank);
  } catch (error) {
    return handleBankError(error, response, 'actualizar');
  }
}

export async function deleteBank(request, response) {
  const bankId = parseBankId(request.params.id);
  if (bankId === null) {
    return warningResponse(response, 'El identificador del banco no es válido.', {}, 400);
  }

  try {
    const bank = await models.Bank.findByPk(bankId);
    if (!bank) {
      return warningResponse(response, 'El banco indicado no existe.', {}, 404);
    }

    const accountCount = await models.BankAccount.count({ where: { bankId } });
    if (accountCount > 0) {
      return warningResponse(
        response,
        'No se puede eliminar el banco porque tiene cuentas bancarias asociadas.',
        {},
        409,
      );
    }

    await bank.destroy();
    return successResponse(response, 'Banco eliminado correctamente.', { id: bankId });
  } catch (error) {
    return handleBankError(error, response, 'eliminar');
  }
}