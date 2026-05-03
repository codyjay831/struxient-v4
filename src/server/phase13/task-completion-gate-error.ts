export class TaskCompletionGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskCompletionGateError";
  }
}

export function isTaskCompletionGateError(e: unknown): e is TaskCompletionGateError {
  return e instanceof TaskCompletionGateError;
}
