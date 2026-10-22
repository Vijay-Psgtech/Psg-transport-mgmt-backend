export default class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // machine readable, e.g. TOKEN_EXPIRED
  }
}
