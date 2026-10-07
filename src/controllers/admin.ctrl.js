import bcrypt from 'bcryptjs';
import { models } from '../config/database.js';
import { createDefaultCalendarSession } from '../constants/calendarSession.js';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

export async function createUser(request, response) {
  const { email, phoneNumber, password, person, roleId,calendarSession } = request.body ?? {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    // valida calendarSession
  if (!calendarSession || typeof calendarSession !== 'object') {
    return warningResponse(response, 'calendarSession es obligatorio.', {}, 400);
  }

  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return warningResponse(response, 'Debes proporcionar un email válido.', {}, 400);
  }

  if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
    return warningResponse(response, 'phoneNumber es obligatorio.', {}, 400);
  }

  if (typeof password !== 'string' || password.length < 8) {
    return warningResponse(response, 'La contraseña debe tener al menos 8 caracteres.', {}, 400);
  }

  if (!person || typeof person !== 'object' || Array.isArray(person)) {
    return warningResponse(response, 'person debe ser un objeto.', {}, 400);
  }

  const parsedRoleId = Number(roleId);
  if (!Number.isInteger(parsedRoleId) || parsedRoleId < 1) {
    return warningResponse(response, 'roleId debe ser un entero válido.', {}, 400);
  }

  try {
    const [existingAccount, role] = await Promise.all([
      models.Account.findOne({ where: { email: normalizedEmail }, attributes: ['id'] }),
      models.Role.findByPk(parsedRoleId, { attributes: ['id'] }),
    ]);

    if (existingAccount) {
      return warningResponse(response, 'Ya existe un usuario con ese email.', {}, 409);
    }

    if (!role) {
      return warningResponse(response, 'El rol indicado no existe.', {}, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const account = await models.Account.create({
      email: normalizedEmail,
      phoneNumber: phoneNumber.trim(),
      pass: hashedPassword,
      person,
      roleId: parsedRoleId,
      calendarSession: createDefaultCalendarSession(),
    });

    return successResponse(response, 'Usuario creado correctamente.', {
      id: account.id,
      email: account.email,
      phoneNumber: account.phoneNumber,
      person: account.person,
      roleId: account.roleId,
      calendarSession: account.calendarSession,
      isActived: account.isActived,
    }, 201);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return warningResponse(response, 'Ya existe un usuario con ese email.', {}, 409);
    }

    console.error('Error al crear usuario:', error.message);
    return errorResponse(response, 'No fue posible crear el usuario.', {}, 500);
  }
}