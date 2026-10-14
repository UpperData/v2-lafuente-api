import bcrypt from 'bcryptjs';
import { models } from '../config/database.js';
import { createDefaultCalendarSession } from '../constants/calendarSession.js';
import { sendNewUserCredentialsEmail } from '../services/email.service.js';
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
    // genera conraseña random y la encripta
    const randomPassword = Math.random().toString(36).slice(-8);
    const passwordToUse = password || randomPassword;
    const hashedPassword = await bcrypt.hash(passwordToUse, 12);
    const account = await models.Account.create({
      email: normalizedEmail,
      phoneNumber: phoneNumber.trim(),
      pass: hashedPassword,
      person,
      roleId: parsedRoleId,
      calendarSession: createDefaultCalendarSession(),
    });

    try {
      await sendNewUserCredentialsEmail({
        to: account.email,
        password: passwordToUse,
      });
    } catch (error) {
      console.error('Usuario creado, pero no fue posible enviar el correo:', error.message);
      return errorResponse(
        response,
        'El usuario fue creado, pero no se pudo enviar el correo con sus credenciales.',
        { id: account.id, email: account.email, emailSent: false },
        502,
      );
    }

    return successResponse(response, 'Usuario creado correctamente.', {
      id: account.id,
      email: account.email,
      phoneNumber: account.phoneNumber,
      person: account.person,
      roleId: account.roleId,
      calendarSession: account.calendarSession,
      isActived: account.isActived,
      emailSent: true,
    }, 201);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return warningResponse(response, 'Ya existe un usuario con ese email.', {}, 409);
    }

    console.error('Error al crear usuario:', error.message);
    return errorResponse(response, 'No fue posible crear el usuario.', {}, 500);
  }
}

export async function listUsers(request, response) {
  try {
    const accounts = await models.Account.findAll({
      attributes: [
        'id',
        'email',
        'phoneNumber',
        'person',
        'roleId',
        'calendarSession',
        'isActived',
        'createdAt',
        'updatedAt',
      ],
      order: [['id', 'ASC']],
      include: [
        {
          model: models.Role,
          as: 'role',
          attributes: ['id', 'name'],
        },
      ],
    });
    // restorna roleName en cada cuenta y elimina campo role
    const accountsWithRoleName = accounts.map((account) => {
      const accountData = account.toJSON();
      return {
        ...accountData,
        roleName: accountData.role ? accountData.role.name : null,
      };
    });
    // Eliminar el campo 'role' de cada cuenta
    const accountsWithoutRole = accountsWithRoleName.map((account) => {
      const { role, ...accountData } = account;
      return accountData;
    });

    return successResponse(response, 'Usuarios listados correctamente.', accountsWithoutRole);
  } catch (error) {
    console.error('Error al listar usuarios:', error.message);
    return errorResponse(response, 'No fue posible listar los usuarios.', {}, 500);
  }
}
export async function updateUser(request, response) {
  const accountId = Number(request.params.id);
  if (!Number.isInteger(accountId) || accountId < 1) {
    return warningResponse(response, 'El identificador del usuario no es válido.', {}, 400);
  }

  const body = request.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return warningResponse(response, 'El cuerpo de la solicitud debe ser un objeto.', {}, 400);
  }

  const updates = {};
  const fields = ['email', 'phoneNumber', 'password', 'person', 'roleId', 'calendarSession', 'isActived'];
  const suppliedFields = fields.filter((field) => Object.hasOwn(body, field));

  if (suppliedFields.length === 0) {
    return warningResponse(response, 'Debes proporcionar al menos un campo para actualizar.', {}, 400);
  }

  if (Object.hasOwn(body, 'email')) {
    const normalizedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return warningResponse(response, 'Debes proporcionar un email válido.', {}, 400);
    }
    updates.email = normalizedEmail;
  }

  if (Object.hasOwn(body, 'phoneNumber')) {
    if (typeof body.phoneNumber !== 'string' || !body.phoneNumber.trim()) {
      return warningResponse(response, 'phoneNumber no puede estar vacío.', {}, 400);
    }
    updates.phoneNumber = body.phoneNumber.trim();
  }

  if (Object.hasOwn(body, 'password')) {
    if (typeof body.password !== 'string' || body.password.length < 8) {
      return warningResponse(response, 'La contraseña debe tener al menos 8 caracteres.', {}, 400);
    }
  }

  if (Object.hasOwn(body, 'person')) {
    if (!body.person || typeof body.person !== 'object' || Array.isArray(body.person)) {
      return warningResponse(response, 'person debe ser un objeto.', {}, 400);
    }
    updates.person = body.person;
  }

  if (Object.hasOwn(body, 'roleId')) {
    const parsedRoleId = Number(body.roleId);
    if (!Number.isInteger(parsedRoleId) || parsedRoleId < 1) {
      return warningResponse(response, 'roleId debe ser un entero válido.', {}, 400);
    }
    updates.roleId = parsedRoleId;
  }

  if (Object.hasOwn(body, 'calendarSession')) {
    console.log('calendarSession:', body.calendarSession);
     // body.calendarSession es un arreglo de objetos, cada objeto debe tener las propiedades: day (entero del 0 al 6), name (string) y calendar (objeto con startTime y endTime)
    if (!Array.isArray(body.calendarSession)) {
      return warningResponse(response, 'calendarSession debe ser un arreglo de objetos.', {}, 400);
    }
    if (!body.calendarSession) {
      return warningResponse(response, 'calendarSession debe ser un objeto.', {}, 400);
    }
    updates.calendarSession = body.calendarSession;
  }

  if (Object.hasOwn(body, 'isActived')) {
    if (typeof body.isActived !== 'boolean') {
      return warningResponse(response, 'isActived debe ser un valor booleano.', {}, 400);
    }
    updates.isActived = body.isActived;
  }

  try {
    if (Object.hasOwn(body, 'password')) {
      updates.pass = await bcrypt.hash(body.password, 12);
    }

    const account = await models.Account.findByPk(accountId);
    if (!account) {
      return warningResponse(response, 'El usuario indicado no existe.', {}, 404);
    }

    if (updates.email) {
      const existingAccount = await models.Account.findOne({
        where: { email: updates.email },
        attributes: ['id'],
      });
      if (existingAccount && existingAccount.id !== account.id) {
        return warningResponse(response, 'Ya existe un usuario con ese email.', {}, 409);
      }
    }

    if (updates.roleId) {
      const role = await models.Role.findByPk(updates.roleId, { attributes: ['id'] });
      if (!role) {
        return warningResponse(response, 'El rol indicado no existe.', {}, 400);
      }
    }

    await account.update(updates);

    return successResponse(response, 'Usuario actualizado correctamente.', {
      id: account.id,
      email: account.email,
      phoneNumber: account.phoneNumber,
      person: account.person,
      roleId: account.roleId,
      calendarSession: account.calendarSession,
      isActived: account.isActived,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return warningResponse(response, 'Ya existe un usuario con ese email.', {}, 409);
    }

    console.error('Error al actualizar usuario:', error.message);
    return errorResponse(response, 'No fue posible actualizar el usuario.', {}, 500);
  }
}

export async function changeStatus(request, response) {
  const accountId = Number(request.params.id);
  if (!Number.isInteger(accountId) || accountId < 1) {
    return warningResponse(response, 'El identificador del usuario no es válido.', {}, 400);
  }

  const { isActived } = request.body ?? {};
  if (typeof isActived !== 'boolean') {
    return warningResponse(response, 'isActived debe ser un valor booleano.', {}, 400);
  }

  try {
    const account = await models.Account.findByPk(accountId);
    if (!account) {
      return warningResponse(response, 'El usuario indicado no existe.', {}, 404);
    }

    await account.update({ isActived });

    return successResponse(
      response,
      `Usuario ${isActived ? 'activado' : 'desactivado'} correctamente.`,
      { id: account.id, isActived: account.isActived },
    );
  } catch (error) {
    console.error('Error al cambiar estado del usuario:', error.message);
    return errorResponse(response, 'No fue posible cambiar el estado del usuario.', {}, 500);
  }
}

export async function roleList(request, response) {
  try {
    const roles = await models.Role.findAll({
      attributes: ['id', 'name', 'description', 'menu', 'isActived', 'createdAt', 'updatedAt'],
      order: [['id', 'ASC']],
    });

    return successResponse(response, 'Roles listados correctamente.', roles);
  } catch (error) {
    console.error('Error al listar roles:', error.message);
    return errorResponse(response, 'No fue posible listar los roles.', {}, 500);
  }
}
