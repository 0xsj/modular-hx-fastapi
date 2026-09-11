import { expect, it } from 'vitest';
import {
  AppError,
  err,
  failure,
  fromCaught,
  mapError,
  publicInfo,
  withDetails,
} from './index.js';

it('example: a refused registration reaches the edge with a safe public response', () => {
  const refused = err(
    failure('conflict', 'email already registered', {
      type: 'account.email_taken',
      fields: { email: 'taken' },
      cause: new Error('PRIVATE database constraint'),
    }),
  );
  const contextual = mapError(refused, (e) =>
    withDetails(e, { operation: 'register account' }),
  );
  try {
    if (!contextual.ok) throw new AppError(contextual.error);
    throw new Error('this example must demonstrate a refusal');
  } catch (caught: unknown) {
    expect(publicInfo(fromCaught(caught))).toEqual({
      kind: 'conflict',
      message: 'email already registered',
      type: 'account.email_taken',
      fields: { email: 'taken' },
    });
  }
});
