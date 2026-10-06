import jwt from 'jsonwebtoken';
import { models } from '../config/database.js';
import { errorResponse, warningResponse } from '../utils/response.js';

export async function requireAdmin(request, response, next) {
  const authorization = request.headers.authorization;
  const [scheme, token] = typeof authorization === 'string'
    ? authorization.split(' ')
    : [];

  if (scheme !== 'Bearer' || !token) {
    return warningResponse(response, 'Se requiere autenticación.', {}, 401);
  }

  if (!process.env.JWT_SECRET) {
    return errorResponse(response, 'La autenticación no está configurada.', {}, 500);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const account = await models.Account.findByPk(payload.sub, {
      attributes: ['id', 'isActived'],
      include: [{ model: models.Role, as: 'role', attributes: ['name'] }],
    });

    if (!account || !account.isActived) {
      return warningResponse(response, 'La sesión no es válida.', {}, 401);
    }

    if (account.role?.id !== 1) {
      return warningResponse(response, 'No tienes permiso para crear usuarios.', {}, 403);
    }

    return next();
  } catch {
    return warningResponse(response, 'La sesión no es válida.', {}, 401);
  }
}