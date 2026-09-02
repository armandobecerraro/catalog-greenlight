import { v4 as uuidv4 } from 'uuid';
import { DomainError } from '../errors/DomainError';

export class WorkflowId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(): WorkflowId {
    return new WorkflowId(uuidv4());
  }

  static fromString(value: string): WorkflowId {
    if (!value || value.trim().length === 0) {
      throw new DomainError('WorkflowId cannot be empty', 'EMPTY_WORKFLOW_ID');
    }
    return new WorkflowId(value.trim());
  }

  get value(): string {
    return this._value;
  }

  equals(other: WorkflowId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
