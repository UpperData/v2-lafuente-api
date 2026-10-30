import jwt from 'jsonwebtoken';
import { models } from '../config/database.js';
import { errorResponse, warningResponse } from '../utils/response.js';

export async function requireAuth(request, response, next) {
  const authorization = request.headers.authorization;
  const match = typeof authorization === 'string'
    ? authorization.match(/^Bearer\s+(\S+)$/)
    : null;

  if (!match) {
    return warningResponse(response, 'Se requiere autenticación.', {}, 401);
  }

  if (!process.env.JWT_SECRET) {
    return errorResponse(response, 'La autenticación no está configurada.', {}, 500);
  }

  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET);
  } catch {
    return warningResponse(response, 'La sesión no es válida o ha expirado.', {}, 401);
  }

  if (!payload.sub || !/^[1-9]\d*$/.test(String(payload.sub))) {
    return warningResponse(response, 'La sesión no es válida o ha expirado.', {}, 401);
  }

  try {
    const account = await models.Account.findByPk(payload.sub, {
      attributes: ['id', 'isActived'],
    });

    if (!account || !account.isActived) {
      return warningResponse(response, 'La sesión no es válida.', {}, 401);
    }

    return next();
  } catch (error) {
    console.error('Error al validar la sesión:', error.message);
    return errorResponse(response, 'No fue posible validar la sesión.', {}, 500);
  }
}
