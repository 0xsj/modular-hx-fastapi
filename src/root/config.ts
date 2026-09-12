import { Reader, type Lookup, type Var } from '../shared/env/index.js';
import {
  err,
  ok,
  failure,
  type Result,
  type Failure,
} from '../shared/errors/index.js';
import { actor } from '../shared/provenance/index.js';
import { type Resource } from '../shared/logger/index.js';
import { SecretString } from '../shared/secret/index.js';
export interface Config {
  resource: Resource;
  format: string;
  level: string;
  color: string;
  capacity: number;
  maxBytes: number;
  flushMs: number;
  verbose: boolean;
  noColor: boolean;
  token: SecretString;
  manifest: Var[];
}
export function loadConfig(lookup: Lookup): Result<Config, Failure> {
  const r = new Reader(lookup);
  const resource: Resource = {
    name: r.string('SERVICE_NAME', 'n2f-foundations'),
    namespace: r.string('SERVICE_NAMESPACE', 'n2f'),
    version: r.string('SERVICE_VERSION', 'dev'),
    environment: r.enumeration('APP_ENV', 'development', [
      'development',
      'test',
      'production',
    ]),
  };
  const format = r.enumeration('LOG_FORMAT', 'console', [
      'console',
      'json',
      'none',
    ]),
    level = r.enumeration('LOG_LEVEL', 'info', [
      'debug',
      'info',
      'warn',
      'error',
    ]),
    color = r.enumeration('LOG_COLOR', 'auto', ['auto', 'always', 'never']);
  const capacity = r.int('LOG_CAPACITY', 256, 1, 65536),
    maxBytes = r.int('LOG_MAX_BYTES', 65536, 256, 1048576),
    flushMs = r.int('LOG_FLUSH_MS', 1000, 1, 10000),
    verbose = r.boolean('DEMO_VERBOSE', false),
    noColor = r.string('NO_COLOR', '') !== '',
    token = r.secret('DEMO_TOKEN');
  const checked = r.check();
  const problems: Record<string, string> = checked.ok
    ? {}
    : { ...checked.error.fields };
  if (!actor('service', resource.name).ok)
    problems.SERVICE_NAME = 'invalid_identity';
  if (Object.keys(problems).length)
    return err(
      failure('invalid', 'invalid configuration', {
        type: 'env.invalid',
        fields: problems,
      }),
    );
  const manifest = r.manifest();
  return manifest.ok
    ? ok({
        resource,
        format,
        level,
        color,
        capacity,
        maxBytes,
        flushMs,
        verbose,
        noColor,
        token,
        manifest: manifest.value,
      })
    : manifest;
}
