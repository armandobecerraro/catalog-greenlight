import { DomainError } from '../errors/DomainError';

export class InvalidCastError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_CAST');
  }
}

export class Cast {
  private readonly _members: readonly string[];

  private constructor(members: readonly string[]) {
    this._members = members;
  }

  static create(members: string[]): Cast {
    if (!members || members.length === 0) {
      throw new InvalidCastError('Cast must contain at least one member');
    }
    const cleaned = members.map(m => m.trim()).filter(m => m.length > 0);
    if (cleaned.length === 0) {
      throw new InvalidCastError('Cast must contain at least one non-empty member');
    }
    return new Cast(Object.freeze([...cleaned]));
  }

  static fromArray(members: readonly string[]): Cast {
    return new Cast(Object.freeze([...members]));
  }

  get members(): readonly string[] {
    return this._members;
  }

  get length(): number {
    return this._members.length;
  }

  includes(member: string): boolean {
    return this._members.includes(member.trim());
  }

  toArray(): string[] {
    return [...this._members];
  }

  equals(other: Cast): boolean {
    if (this._members.length !== other._members.length) return false;
    return this._members.every((m, i) => m === other._members[i]);
  }
}
