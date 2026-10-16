/** G10: every analysis use case refuses to run until the lawyer confirms the stance. */
export class StanceNotConfirmedError extends Error {
  constructor() {
    super('The client stance has not been confirmed by the lawyer (G10).');
    this.name = 'StanceNotConfirmedError';
  }
}
