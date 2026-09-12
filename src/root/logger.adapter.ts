import { type LoggerService } from '@nestjs/common';
import { type Logger } from '../shared/logger/index.js';
/** Framework signatures stop here; diagnostic stack parameters are discarded. */
export class NestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}
  #write(
    level: 'info' | 'debug' | 'warn' | 'error',
    message: unknown,
    params: unknown[],
  ): void {
    const last = params.at(-1);
    const fields = typeof last === 'string' ? { context: last } : {};
    if (typeof message === 'string') this.logger[level](message, fields);
    else this.logger.withError(message)[level]('framework event', fields);
  }
  log(message: unknown, ...params: unknown[]): void {
    this.#write('info', message, params);
  }
  debug(message: unknown, ...params: unknown[]): void {
    this.#write('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]): void {
    this.#write('debug', message, params);
  }
  warn(message: unknown, ...params: unknown[]): void {
    this.#write('warn', message, params);
  }
  error(message: unknown, ...params: unknown[]): void {
    this.#write('error', message, params.length > 1 ? [params.at(-1)] : []);
  }
  fatal(message: unknown, ...params: unknown[]): void {
    this.#write('error', message, params);
  }
}
