import { models } from '../config/database.js';
import {
  errorResponse,
  successResponse,
} from '../utils/response.js';

export async function listClients(_request, response) {
    const {isActived} = _request.query;
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