import { models } from '../config/database.js';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

const clientFields = [
  'documentId',
  'firstName',
  'lastName',
  'isFamele',
  'email',
  'phoneNumber',
  'address',
  'isActived',
];

function validateClientFields(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El cuerpo de la solicitud debe ser un objeto.' };
  }

  const suppliedFields = clientFields.filter((field) => Object.hasOwn(body, field));
  if (suppliedFields.length === 0) {
    return { error: 'Debes proporcionar al menos un campo del cliente.' };
  }

  if (creating) {
    const requiredFields = ['documentId', 'firstName', 'lastName'];
    const missingField = requiredFields.find(
      (field) => typeof body[field] !== 'string' || !body[field].trim(),
    );
    if (missingField) {
      return { error: `${missingField} es obligatorio.` };
    }
  }

  const updates = {};
  for (const field of suppliedFields) {
    const value = body[field];
    if (['isFamele', 'isActived'].includes(field)) {
      if (typeof value !== 'boolean') {
        return { error: `${field} debe ser un valor booleano.` };
      }
      updates[field] = value;
      continue;
    }

    if (typeof value !== 'string' || !value.trim()) {
      return { error: `${field} debe ser un texto no vacío.` };
    }
    updates[field] = value.trim();
  }

  if (
    Object.hasOwn(updates, 'email')
    && !/^\S+@\S+\.\S+$/.test(updates.email)
  ) {
    return { error: 'Debes proporcionar un email válido.' };
  }

  return { updates };
}

export async function listClients(_request, response) {
  const { isActived } = _request.query;
  try {
    const clients = await models.ReserveAccount.findAll({
      attributes: [
        'id',
        'documentId',
        'firstName',
        'lastName',
        'isFamele',
        'email',
        'phoneNumber',
        'address',
        'isActived',
        'currentBalance',
        'createdAt',
        'updatedAt',
      ],
      order: [['id', 'ASC']],
      where: isActived !== undefined ? { isActived: isActived === 'true' } : {},
    });

    return successResponse(response, 'Clientes listados correctamente.', clients);
  } catch (error) {
    console.error('Error al listar clientes:', error.message);
    return errorResponse(response, 'No fue posible listar los clientes.', {}, 500);
  }
}

export async function addClient(request, response) {
  const { updates, error } = validateClientFields(request.body, { creating: true });
  if (error) {
    return warningResponse(response, error, {}, 400);
  }

  try {
    const client = await models.ReserveAccount.create(updates);
    return successResponse(response, 'Cliente creado correctamente.', client, 201);
  } catch (error) {
    console.error('Error al crear cliente:', error.message);
    return errorResponse(response, 'No fue posible crear el cliente.', {}, 500);
  }
}

export async function editClient(request, response) {
  const clientId = Number(request.params.id);
  if (!Number.isInteger(clientId) || clientId < 1) {
    return warningResponse(response, 'El identificador del cliente no es válido.', {}, 400);
  }

  const { updates, error } = validateClientFields(request.body);
  if (error) {
    return warningResponse(response, error, {}, 400);
  }

  try {
    const client = await models.ReserveAccount.findByPk(clientId);
    if (!client) {
      return warningResponse(response, 'El cliente indicado no existe.', {}, 404);
    }

    await client.update(updates);
    return successResponse(response, 'Cliente actualizado correctamente.', client);
  } catch (error) {
    console.error('Error al actualizar cliente:', error.message);
    return errorResponse(response, 'No fue posible actualizar el cliente.', {}, 500);
  }
}