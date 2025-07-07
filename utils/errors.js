class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, details);
  }
}

class DatabaseError extends AppError {
  constructor(message, details) {
    super(message, 500, details);
  }
}

class NotFoundError extends AppError {
  constructor(message, details) {
    super(message, 404, details);
  }
}

class OrderError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "OrderError";
  }
}

class PaymentError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "PaymentError";
  }
}

module.exports = {
  AppError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  OrderError,
  PaymentError,
};
