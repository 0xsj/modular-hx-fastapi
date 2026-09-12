/** Concrete JetStream JSON protocol over the official NATS connection client. */
import {
  connect,
  headers,
  type NatsConnection,
  type Msg,
  type MsgHdrs,
} from '@nats-io/transport-node';
import { isDeepStrictEqual } from 'node:util';
import { Envelope, type Publisher, type Receipt } from '../index.js';
import { SecretString } from '../../secret/index.js';
import {
  AppError,
  err,
  failure,
  ok,
  type Failure,
  type Result,
} from '../../errors/index.js';
export type Config = {
  url: SecretString;
  stream: string;
  consumer: string;
  timeoutMs: number;
};
const unavailable = () =>
  failure('unavailable', 'JetStream operation incomplete', {
    type: 'events.jetstream_unavailable',
  });
const invalid = () =>
  failure('invalid', 'invalid JetStream configuration', {
    type: 'events.jetstream_config',
  });
function value<T>(r: Result<T, Failure>): T {
  if (!r.ok) throw new AppError(r.error);
  return r.value;
}
function compatible(
  got: Record<string, unknown>,
  want: Record<string, unknown>,
): boolean {
  return (
    !!got &&
    Object.entries(want).every(([key, expected]) =>
      isDeepStrictEqual(got[key], expected),
    )
  );
}
export class Broker implements Publisher {
  readonly #subject: string;
  private constructor(
    private readonly nc: NatsConnection,
    private readonly config: Config,
  ) {
    this.#subject = 'n2f.events.' + config.stream;
  }
  static async open(config: Config): Promise<Result<Broker, Failure>> {
    try {
      const url = new URL(config.url.reveal());
      if (
        !['nats:', 'tls:'].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname ||
        !/^[A-Za-z0-9_]{1,40}$/.test(config.stream) ||
        !/^[A-Za-z0-9_]{1,40}$/.test(config.consumer) ||
        !Number.isInteger(config.timeoutMs) ||
        config.timeoutMs < 1 ||
        config.timeoutMs > 5000
      )
        return err(invalid());
    } catch {
      return err(invalid());
    }
    try {
      const nc = await connect({
        servers: config.url.reveal(),
        timeout: config.timeoutMs,
        reconnect: false,
      });
      return ok(new Broker(nc, { ...config }));
    } catch {
      return err(unavailable());
    }
  }
  async close(): Promise<void> {
    await this.nc.close();
  }
  private async operation<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    caller?: AbortSignal,
  ): Promise<Result<T, Failure>> {
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), this.config.timeoutMs);
    const signal = caller
      ? AbortSignal.any([caller, deadline.signal])
      : deadline.signal;
    try {
      return ok(await fn(signal));
    } catch (e) {
      return err(
        caller?.aborted
          ? failure('canceled', 'JetStream operation canceled')
          : e instanceof AppError
            ? e.failure
            : unavailable(),
      );
    } finally {
      clearTimeout(timer);
    }
  }
  private async request(
    subject: string,
    data: Uint8Array,
    signal: AbortSignal,
    hdrs?: MsgHdrs,
  ): Promise<Msg> {
    signal.throwIfAborted();
    let onAbort!: () => void;
    try {
      const message = await Promise.race([
        this.nc.request(subject, data, {
          timeout: this.config.timeoutMs,
          noMux: true,
          headers: hdrs,
        }),
        new Promise<never>((_, reject) => {
          onAbort = () => reject(new Error('canceled'));
          signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
      if (message.data.length > 131072) throw new AppError(unavailable());
      return message;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }
  private async api(
    subject: string,
    input: unknown,
    signal: AbortSignal,
  ): Promise<any> {
    const message = await this.request(
      subject,
      Buffer.from(JSON.stringify(input)),
      signal,
    );
    const out = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(message.data),
    );
    if (!out || typeof out !== 'object') throw new AppError(unavailable());
    return out;
  }
  provision(caller?: AbortSignal): Promise<Result<void, Failure>> {
    return this.operation(async (signal) => {
      const stream = {
        name: this.config.stream,
        subjects: [this.#subject],
        storage: 'file',
        num_replicas: 1,
        retention: 'limits',
        discard: 'new',
        max_bytes: 67108864,
        max_msg_size: 131072,
        duplicate_window: 120000000000,
      };
      let info = await this.api(
        '$JS.API.STREAM.INFO.' + this.config.stream,
        {},
        signal,
      );
      if (info.error?.code === 404)
        info = await this.api(
          '$JS.API.STREAM.CREATE.' + this.config.stream,
          stream,
          signal,
        );
      if (info.error) throw new AppError(unavailable());
      if (!compatible(info.config, stream)) throw new AppError(invalid());
      const consumer = {
        durable_name: this.config.consumer,
        ack_policy: 'explicit',
        ack_wait: 1000000000,
        max_deliver: 5,
        max_ack_pending: 1,
        filter_subject: this.#subject,
        deliver_policy: 'all',
        replay_policy: 'instant',
      };
      info = await this.api(
        '$JS.API.CONSUMER.INFO.' +
          this.config.stream +
          '.' +
          this.config.consumer,
        {},
        signal,
      );
      if (info.error?.code === 404)
        info = await this.api(
          '$JS.API.CONSUMER.DURABLE.CREATE.' +
            this.config.stream +
            '.' +
            this.config.consumer,
          { stream_name: this.config.stream, config: consumer },
          signal,
        );
      if (info.error) throw new AppError(unavailable());
      if (!compatible(info.config, consumer)) throw new AppError(invalid());
    }, caller);
  }
  publish(
    event: Envelope,
    caller?: AbortSignal,
  ): Promise<Result<Receipt, Failure>> {
    return this.operation(async (signal) => {
      const h = headers();
      h.set('Nats-Msg-Id', event.id);
      h.set('Nats-Expected-Stream', this.config.stream);
      const msg = await this.request(this.#subject, event.bytes(), signal, h);
      const ack = JSON.parse(new TextDecoder().decode(msg.data));
      if (
        ack.error ||
        ack.stream !== this.config.stream ||
        !Number.isSafeInteger(ack.seq) ||
        ack.seq <= 0
      )
        throw new AppError(unavailable());
      if (ack.duplicate) {
        const stored = await this.api(
          '$JS.API.STREAM.MSG.GET.' + this.config.stream,
          { seq: ack.seq },
          signal,
        );
        if (typeof stored.message?.data !== 'string')
          throw new AppError(unavailable());
        const original = JSON.parse(
          Buffer.from(stored.message.data, 'base64').toString('utf8'),
        );
        if (
          !isDeepStrictEqual(
            original,
            JSON.parse(Buffer.from(event.bytes()).toString('utf8')),
          )
        )
          throw new AppError(
            failure('conflict', 'event delivery conflict', {
              type: 'events.id_reused',
            }),
          );
      }
      return { eventId: event.id, durable: true };
    }, caller);
  }
  transfer(
    sink: Publisher,
    caller?: AbortSignal,
  ): Promise<Result<boolean, Failure>> {
    return this.operation(async (signal) => {
      const msg = await this.request(
        '$JS.API.CONSUMER.MSG.NEXT.' +
          this.config.stream +
          '.' +
          this.config.consumer,
        Buffer.from('{"batch":1,"no_wait":true}'),
        signal,
      );
      if ([404, 408].includes(msg.headers?.code ?? 0)) return false;
      if (!msg.reply) throw new AppError(unavailable());
      const event = value(Envelope.decode(msg.data));
      const receipt = value(await sink.publish(event, signal));
      if (!receipt.durable || receipt.eventId !== event.id)
        throw new AppError(unavailable());
      await this.request(msg.reply, Buffer.from('+ACK'), signal);
      return true;
    }, caller);
  }
}
