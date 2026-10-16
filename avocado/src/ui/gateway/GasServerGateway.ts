import { RpcGateway } from './RpcGateway';

/** An error raised on the server, rebuilt on the client with its name and extra fields. */
export class RemoteError extends Error {
  readonly remoteName: string;
  readonly details: Record<string, unknown>;
  constructor(error: { name: string; message: string } & Record<string, unknown>) {
    super(error.message);
    const { name, message: _m, ...details } = error;
    this.name = 'RemoteError';
    this.remoteName = name;
    this.details = details;
  }
}

/** The slice of `google.script.run` we use: one entry point, `avocadoRpc(method, argsJson)`. */
export interface ScriptRunLike {
  withSuccessHandler(fn: (value: string) => void): ScriptRunLike;
  withFailureHandler(fn: (error: Error) => void): ScriptRunLike;
  avocadoRpc(method: string, argsJson: string): void;
}

/** Production gateway: google.script.run wrapped in Promises (§9.2). */
export class GasServerGateway extends RpcGateway {
  constructor(run: ScriptRunLike) {
    super(
      (method, argsJson) =>
        new Promise((resolve, reject) => {
          run
            .withSuccessHandler((json) => {
              const reply = JSON.parse(json) as
                | { ok: true; value: unknown }
                | { ok: false; error: { name: string; message: string } & Record<string, unknown> };
              if (reply.ok) resolve(reply.value);
              else reject(new RemoteError(reply.error));
            })
            .withFailureHandler(reject)
            .avocadoRpc(method, argsJson);
        }),
    );
  }
}
