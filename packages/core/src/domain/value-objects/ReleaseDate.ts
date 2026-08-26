import { DomainError } from '../errors/DomainError';

export class InvalidReleaseDateError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_RELEASE_DATE');
  }
}

export class ReleaseDate {
  private readonly _value: Date;

  private constructor(value: Date) {
    this._value = value;
  }

  static create(value: Date | string): ReleaseDate {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
      throw new InvalidReleaseDateError('Release date must be a valid date');
    }
    if (date > new Date()) {
      throw new InvalidReleaseDateError('Release date cannot be in the future');
    }
    return new ReleaseDate(date);
  }

  static fromDate(value: Date): ReleaseDate {
    return new ReleaseDate(value);
  }

  get value(): Date {
    return this._value;
  }

  toISOString(): string {
    return this._value.toISOString();
  }

  toDateOnlyString(): string {
    return this._value.toISOString().split('T')[0];
  }

  equals(other: ReleaseDate): boolean {
    return this._value.getTime() === other._value.getTime();
  }

  toString(): string {
    return this._value.toISOString();
  }
}
