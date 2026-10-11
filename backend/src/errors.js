// Errors that are safe to show to API clients. Anything that is NOT an
// AppError is treated as an unexpected failure and the client only receives a
// generic message (see middleware/errorHandler.js).

class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super(400, 'Validation failed', details);
    this.name = 'ValidationError';
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(409, message);
    this.name = 'ConflictError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

module.exports = { AppError, ValidationError, ConflictError, NotFoundError };
