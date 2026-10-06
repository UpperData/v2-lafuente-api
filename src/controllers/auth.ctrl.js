import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { models } from '../config/database.js';
import {
	errorResponse,
	successResponse,
	warningResponse,
} from '../utils/response.js';

export async function login(request, response) {
	const username = typeof request.body?.username === 'string'
		? request.body.username.trim()
		: '';
	const password = request.body?.password;

	if (!username || typeof password !== 'string' || !password) {
		return warningResponse(response, 'username y password son obligatorios.', {}, 400);
	}

	if (!process.env.JWT_SECRET) {
		return errorResponse(response, 'La autenticación no está configurada.', {}, 500);
	}

	try {
		const account = await models.Account.findOne({
			where: { email: username },
			attributes: ['id', 'email', 'pass', 'isActived', 'person', 'roleId'],
            include: [
                {
                    model: models.Role, 
                    as: 'role',
                    attributes: ['id', 'name'],
                },
            ],
		});

		if (!account || !account.isActived) {
			return warningResponse(response, 'Usuario o contraseña incorrectos.', {}, 401);
		}

		const passwordMatches = await bcrypt.compare(password, account.pass);
		if (!passwordMatches) {
			return warningResponse(response, 'Usuario o contraseña incorrectos.', {}, 401);
		}

		const token = jwt.sign(
			{ roleId: account.roleId },
			process.env.JWT_SECRET,
			{
				subject: String(account.id),
				expiresIn: process.env.JWT_EXPIRES_IN || '8h',
			},
		);

		return successResponse(response, 'Inicio de sesión exitoso.', {
			token,
			user: {
				id: account.id,
				username: account.email,
				person: account.person,
                role: account.role ? { id: account.role.id, name: account.role.name } : null,
				
			},
		});
	} catch (error) {
		console.error('Error al procesar el inicio de sesión:', error.message);
		return errorResponse(response, 'No fue posible iniciar sesión.', {}, 500);
	}
}
