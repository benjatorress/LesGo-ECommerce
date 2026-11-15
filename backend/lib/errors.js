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
  if (!malformedJson) {
    // Un 500 sin rastro obliga a depurar a ciegas. Se registra el origen del
    // error (PostgreSQL: `code`; Stripe: `type`/`code`), nunca el payload.
    const origen = [error.name, error.type, error.code].filter(Boolean).join(' ');
    console.error(
      `[error] ${req.method} ${req.originalUrl} → ${origen || 'sin tipo'}: ${error.message ?? error}`
    );
  }
  // Fuera de producción se expone el código para diagnosticar desde el navegador.
  const pista = malformedJson || process.env.NODE_ENV === 'production'
    ? ''
    : ` Código: ${[error.type, error.code].filter(Boolean).join('/') || 'sin código'}.`;
  res.status(malformedJson ? 400 : 500).json({
    success: false,
    code: 'REQUEST_FAILED',
    message: malformedJson ? 'JSON inválido.' : `No se pudo procesar la solicitud.${pista}`
  });
}
