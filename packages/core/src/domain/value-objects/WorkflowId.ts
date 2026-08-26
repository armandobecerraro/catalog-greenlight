export class WorkflowId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(): WorkflowId {
    return new WorkflowId(`wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  }

  static fromString(value: string): WorkflowId {
    if (!value || value.trim().length === 0) {
      throw new DomainError('WorkflowId cannot be empty');
    }
    return new WorkflowId(value);
  }

  get value(): string { return this._value; }

  equals(other: WorkflowId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
