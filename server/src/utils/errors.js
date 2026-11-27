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

export const unauthenticated = (message = 'Please log in', code = 'UNAUTHENTICATED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'You do not have access to this') =>
  new AppError(403, 'FORBIDDEN', message);

// Redis (rate limits, token revocation) is required for auth to be safe.
// If it's down we refuse rather than silently skip the check.
export const serviceUnavailable = (message = 'Service temporarily unavailable, try again shortly') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);
