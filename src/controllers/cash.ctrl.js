import { GoogleGenAI } from '@google/genai';
import {
  errorResponse,
  successResponse,
  warningResponse,
} from '../utils/response.js';

const allowedDenominations = new Set([1, 2, 5, 10, 20, 50, 100]);

const billResponseSchema = {
  type: 'OBJECT',
  properties: {
    bills: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          denomination: {
            type: 'INTEGER',
            description: 'Valor nominal del billete en dólares estadounidenses.',
          },
          serial: {
            type: 'STRING',
            description: 'Número de serie impreso en el billete; cadena vacía si no es legible.',
          },
        },
        required: ['denomination', 'serial'],
      },
    },
  },
  required: ['bills'],
};

export async function recognizeDollarBills(request, response) {
  if (!request.file) {
    return warningResponse(response, 'Debes adjuntar una imagen en el campo image.', {}, 400);
  }

  if (!process.env.GEMINI_API_KEY) {
    return errorResponse(response, 'El servicio de análisis de imágenes no está configurado.', {}, 500);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const generationRequest = {
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: request.file.mimetype,
            data: request.file.buffer.toString('base64'),
          },
        },
        {
          text: [
            'Analiza la imagen y detecta billetes físicos de dólar estadounidense (USD).',
            'Devuelve cada billete visible una sola vez en la lista bills.',
            'Incluye únicamente la denominación nominal: 1, 2, 5, 10, 20, 50 o 100.',
            'Para cada billete, transcribe el número de serie exactamente como aparece. No lo inventes; usa una cadena vacía si no es legible.',
            'No incluyas monedas, otras monedas, texto impreso ni billetes que no puedas identificar.',
            'Si no hay billetes USD identificables, devuelve bills como una lista vacía.',
          ].join(' '),
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: billResponseSchema,
      },
    };
    let result;

    for (let attempt = 0; ; attempt += 1) {
      try {
        result = await ai.models.generateContent(generationRequest);
        break;
      } catch (error) {
        if (error?.status !== 503 || attempt >= 2) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    const parsedResult = JSON.parse(result.text);
    if (!Array.isArray(parsedResult.bills)) {
      throw new Error('El servicio de análisis devolvió un formato inesperado.');
    }

    const bills = parsedResult.bills.map(({ denomination, serial }) => {
      if (!allowedDenominations.has(denomination)) {
        throw new Error('El servicio de análisis devolvió una denominación no válida.');
      }
      if (typeof serial !== 'string') {
        throw new Error('El servicio de análisis devolvió un serial no válido.');
      }
      return { denomination, currency: 'USD', serial: serial.trim() || null };
    });

    return successResponse(response, 'Billetes identificados correctamente.', bills);
  } catch (error) {
    console.error('Error al identificar billetes:', error.message);
    if (error?.status === 503) {
      response.set('Retry-After', '5');
      return errorResponse(
        response,
        'El servicio de análisis está temporalmente saturado. Inténtalo de nuevo más tarde.',
        {},
        503,
      );
    }
    return errorResponse(response, 'No fue posible analizar la imagen.', {}, 502);
  }
}
