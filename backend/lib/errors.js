export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }

  const malformedJson = error.type === 'entity.parse.failed';
  res.status(malformedJson ? 400 : 500).json({
    success: false,
    code: 'REQUEST_FAILED',
    message: malformedJson ? 'JSON inválido.' : 'No se pudo procesar la solicitud.'
  });
}
