export const ResponseResult = Object.freeze({
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
});

export function sendResponse(response, {
  result,
  message = '',
  data = {},
  statusCode = 200,
}) {
  return response.status(statusCode).json({
    result,
    message,
    data: data ?? {},
  });
}

export const successResponse = (response, message, data = {}, statusCode = 200) =>
  sendResponse(response, { result: ResponseResult.SUCCESS, message, data, statusCode });

export const warningResponse = (response, message, data = {}, statusCode = 400) =>
  sendResponse(response, { result: ResponseResult.WARNING, message, data, statusCode });

export const errorResponse = (response, message, data = {}, statusCode = 500) =>
  sendResponse(response, { result: ResponseResult.ERROR, message, data, statusCode });