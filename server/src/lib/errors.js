// Throw an AppError anywhere in a route and the error middleware turns it into
// the standard response: { error: { code, message, details? } }
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message);
