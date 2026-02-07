export abstract class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    if (process.env.NODE_ENV !== 'production' && Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export interface ErrorOptions {
  [key: string]: unknown;
}
