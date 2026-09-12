import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';
import type { Result, Failure } from '../../../shared/errors/index.js';
import { parse, type ID } from '../../../shared/id/index.js';
import { SecretString } from '../../../shared/secret/index.js';
import { Email } from './email.js';
import { NewPassword, PasswordInput } from './password.js';
import { TokenDigest, parseTokenPurpose, type TokenPurpose } from './token.js';
import { PasswordCredential, type CredentialSnapshot } from './credential.js';
import { AuthState } from './auth-state.js';
import { Session, type SessionSnapshot } from './session.js';
import { Challenge, type ChallengeSnapshot } from './challenge.js';
const value = <T>(r: Result<T, Failure>): T => {
  if (!r.ok) throw Error('expected success: ' + r.error.type);
  return r.value;
};
const refusal = <T>(r: Result<T, Failure>, kind: string, type: string) => {
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.error.kind).toBe(kind);
    expect(r.error.type).toBe(type);
  }
};
const id = value(parse('00000000-0000-4000-8000-000000000002'));
const principalId = value(parse('00000000-0000-4000-8000-000000000001'));
const digest = (p: TokenPurpose) =>
  value(TokenDigest.parse(p, new Uint8Array(32)));
type Fixture = {
  group: string;
  name: string;
  input: string;
  value?: string;
  error?: string;
};
const fixtures = JSON.parse(
  readFileSync(new URL('./testdata/auth_values.json', import.meta.url), 'utf8'),
) as Fixture[];
for (const f of fixtures)
  it('auth values: ' + f.group + '/' + f.name, () => {
    let result: Result<unknown, Failure>;
    let output: unknown;
    switch (f.group) {
      case 'email': {
        const r = Email.parse(f.input);
        result = r;
        if (r.ok) output = r.value.reveal();
        break;
      }
      case 'new_password': {
        const r = NewPassword.parse(new SecretString(f.input));
        result = r;
        if (r.ok) output = r.value.secret().reveal();
        break;
      }
      case 'login_password': {
        const r = PasswordInput.parse(new SecretString(f.input));
        result = r;
        if (r.ok) output = r.value.secret().reveal();
        break;
      }
      case 'purpose': {
        const r = parseTokenPurpose(f.input);
        result = r;
        if (r.ok) output = r.value;
        break;
      }
      default:
        throw Error('unknown fixture group');
    }
    if (f.error) refusal(result, 'invalid', f.error);
    else {
      value(result);
      expect(output).toBe(f.value);
    }
  });
it('auth malformed Unicode and forged inputs refuse', () => {
  for (const raw of ['\ud800', '\udfff']) {
    refusal(Email.parse(raw), 'invalid', 'identity.email_invalid');
    refusal(
      NewPassword.parse(new SecretString(raw)),
      'invalid',
      'identity.password_invalid',
    );
    refusal(
      PasswordInput.parse(new SecretString(raw)),
      'invalid',
      'identity.password_invalid',
    );
  }
  refusal(
    Email.parse(undefined as unknown as string),
    'invalid',
    'identity.email_invalid',
  );
  refusal(
    NewPassword.parse({} as SecretString),
    'invalid',
    'identity.password_invalid',
  );
});
it('auth private presentation redacts', () => {
  const email = value(Email.parse('PRIVATE.SENTINEL@example.com'));
  const password = value(
    NewPassword.parse(new SecretString('private-password-sentinel')),
  );
  for (const v of [email, password, digest('session')]) {
    for (const output of [String(v), JSON.stringify(v), inspect(v)]) {
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('sentinel');
    }
  }
});
it('auth digest owns bytes and validates purpose and size', () => {
  for (const p of [
    'session',
    'email_verification',
    'password_reset',
    'websocket_upgrade',
  ] as const) {
    const raw = new Uint8Array(32);
    raw[0] = 7;
    const d = value(TokenDigest.parse(p, raw));
    raw[0] = 9;
    const copy = d.bytes();
    copy[0] = 10;
    expect(d.bytes()[0]).toBe(7);
    expect(d.purpose()).toBe(p);
  }
  for (const n of [0, 31, 33])
    refusal(
      TokenDigest.parse('session', new Uint8Array(n)),
      'invalid',
      'identity.token_invalid',
    );
  refusal(
    TokenDigest.parse('other' as TokenPurpose, new Uint8Array(32)),
    'invalid',
    'identity.token_invalid',
  );
});
const credentialSeed = (): CredentialSnapshot => ({
  principalId,
  email: value(Email.parse('a@example.com')),
  passwordHash: new SecretString('private-hash-sentinel'),
  passwordVersion: 8,
  createdAtMs: 0,
  changedAtMs: 10,
  verifiedAtMs: 0,
});
it('auth credential restore preserves presence and owns snapshot', () => {
  const seed = credentialSeed(),
    c = value(PasswordCredential.restore(seed)),
    got = c.snapshot();
  expect(got.passwordVersion).toBe(8);
  expect(got.changedAtMs).toBe(10);
  expect(got.verifiedAtMs).toBe(0);
  expect(got.passwordHash.reveal()).toBe('private-hash-sentinel');
  seed.verifiedAtMs = 7;
  got.verifiedAtMs = 8;
  expect(c.snapshot().verifiedAtMs).toBe(0);
  seed.verifiedAtMs = undefined;
  expect(
    value(PasswordCredential.restore(seed)).snapshot().verifiedAtMs,
  ).toBeUndefined();
});
it('auth credential refuses corrupt history and hash', () => {
  const base = credentialSeed();
  base.createdAtMs = 10;
  base.verifiedAtMs = 10;
  for (const changes of [
    { principalId: 'bad' },
    { email: {} },
    { passwordVersion: 0 },
    { passwordVersion: 2147483648 },
    { changedAtMs: 9 },
    { verifiedAtMs: 9 },
    { createdAtMs: -1 },
    { changedAtMs: 253402300800000 },
    { verifiedAtMs: null },
    { passwordVersion: 0.5 },
  ])
    refusal(
      PasswordCredential.restore({ ...base, ...changes } as CredentialSnapshot),
      'invalid',
      'identity.credential_invalid',
    );
  for (const hash of ['', 'x'.repeat(513)])
    refusal(
      PasswordCredential.restore({
        ...base,
        passwordHash: new SecretString(hash),
      }),
      'internal',
      'identity.credential_corrupt',
    );
});
it('auth epoch transitions guard stale and exhausted versions', () => {
  const s = value(AuthState.create(principalId, 7)),
    next = value(s.invalidate(7));
  expect([s.epoch(), next.epoch(), next.principalId()]).toEqual([
    7,
    8,
    principalId,
  ]);
  refusal(s.invalidate(6), 'conflict', 'identity.version_conflict');
  refusal(
    value(AuthState.create(principalId, 2147483647)).invalidate(2147483647),
    'conflict',
    'identity.version_exhausted',
  );
  for (const epoch of [0, -1, 2147483648, NaN, Infinity, 0.5])
    refusal(
      AuthState.create(principalId, epoch),
      'invalid',
      'identity.auth_state_invalid',
    );
  refusal(
    AuthState.create('bad' as ID, 1),
    'invalid',
    'identity.auth_state_invalid',
  );
  const forged = Reflect.construct(AuthState, [principalId, 0]) as AuthState;
  refusal(forged.invalidate(0), 'invalid', 'identity.auth_state_invalid');
});
const sessionSeed = (): SessionSnapshot => ({
  id,
  principalId,
  tokenDigest: digest('session'),
  authEpoch: 3,
  issuedAtMs: 0,
  lastSeenAtMs: 0,
  absoluteExpiresAtMs: 100,
  idleExpiresAtMs: 20,
});
it('auth session issue and activity preserve absolute expiry', () => {
  const seed = sessionSeed(),
    s = value(Session.issue(id, principalId, seed.tokenDigest, 3, 0, 100, 20));
  expect(s.snapshot()).toEqual(seed);
  value(s.check(19));
  const next = value(s.touch(10, 30));
  expect(next.snapshot()).toEqual({
    ...seed,
    lastSeenAtMs: 10,
    idleExpiresAtMs: 40,
  });
  expect(s.snapshot()).toEqual(seed);
  const capped = value(next.touch(30, 90));
  expect(capped.snapshot().idleExpiresAtMs).toBe(100);
  expect(capped.snapshot().absoluteExpiresAtMs).toBe(100);
  for (const now of [20, 100])
    refusal(s.check(now), 'unauthenticated', 'identity.session_rejected');
  refusal(next.check(9), 'unauthenticated', 'identity.session_rejected');
  refusal(s.touch(20, 30), 'unauthenticated', 'identity.session_rejected');
  refusal(s.touch(10, 0), 'invalid', 'identity.session_invalid');
  refusal(
    s.touch(10, Number.MAX_SAFE_INTEGER),
    'invalid',
    'identity.session_invalid',
  );
});
it('auth session revocation preserves first zero timestamp', () => {
  const seed = sessionSeed(),
    s = value(Session.restore(seed)),
    revoked = value(s.revoke(0)),
    again = value(revoked.revoke(10));
  expect(again.snapshot().revokedAtMs).toBe(0);
  expect(s.snapshot().revokedAtMs).toBeUndefined();
  refusal(again.check(1), 'unauthenticated', 'identity.session_rejected');
  refusal(again.touch(1, 20), 'unauthenticated', 'identity.session_rejected');
  const snapshot = again.snapshot(),
    restored = value(Session.restore(snapshot));
  snapshot.revokedAtMs = 99;
  const out = restored.snapshot();
  out.revokedAtMs = 98;
  expect(restored.snapshot().revokedAtMs).toBe(0);
  value(s.revoke(101));
  refusal(s.revoke(-1), 'invalid', 'identity.session_invalid');
});
it('auth session rejects corrupt snapshots and forged instances', () => {
  const seed = sessionSeed();
  for (const changes of [
    { id: 'bad' },
    { principalId: 'bad' },
    { tokenDigest: {} },
    { authEpoch: 0 },
    { authEpoch: 2147483648 },
    { issuedAtMs: -1 },
    { lastSeenAtMs: -1 },
    { issuedAtMs: 10 },
    { idleExpiresAtMs: 0 },
    { idleExpiresAtMs: 101 },
    { lastSeenAtMs: 21 },
    { absoluteExpiresAtMs: 253402300800000 },
    { revokedAtMs: -1 },
    { revokedAtMs: null },
    { lastSeenAtMs: NaN },
    { authEpoch: 0.5 },
  ])
    refusal(
      Session.restore({ ...seed, ...changes } as SessionSnapshot),
      'invalid',
      'identity.session_invalid',
    );
  refusal(
    Session.restore({ ...seed, tokenDigest: digest('password_reset') }),
    'invalid',
    'identity.session_invalid',
  );
  const forged = Reflect.construct(Session, [
    { ...seed, authEpoch: 0 },
  ]) as Session;
  refusal(forged.check(0), 'invalid', 'identity.session_invalid');
});
const challengeSeed = (purpose: TokenPurpose): ChallengeSnapshot => ({
  id,
  principalId,
  tokenDigest: digest(purpose),
  passwordVersion: 7,
  issuedAtMs: 0,
  expiresAtMs: 100,
});
it('auth challenge consumption guards purpose version expiry and terminal facts', () => {
  for (const purpose of ['email_verification', 'password_reset'] as const) {
    const seed = challengeSeed(purpose),
      c = value(Challenge.issue(id, principalId, seed.tokenDigest, 7, 0, 100));
    expect(c.snapshot()).toEqual(seed);
    const used = value(c.consume(purpose, 7, 0));
    const other =
      purpose === 'email_verification'
        ? 'password_reset'
        : 'email_verification';
    refusal(
      c.consume(other, 7, 1),
      'unauthenticated',
      'identity.challenge_rejected',
    );
    expect(value(c.consume(purpose, 7, 99)).snapshot().consumedAtMs).toBe(99);
    const future = value(Challenge.restore({ ...seed, issuedAtMs: 10 }));
    refusal(
      future.consume(purpose, 7, 9),
      'unauthenticated',
      'identity.challenge_rejected',
    );
    expect(used.snapshot().consumedAtMs).toBe(0);
    expect(c.snapshot().consumedAtMs).toBeUndefined();
    refusal(
      used.consume(purpose, 7, 1),
      'unauthenticated',
      'identity.challenge_rejected',
    );
    refusal(
      c.consume(purpose, 6, 1),
      'unauthenticated',
      'identity.challenge_rejected',
    );
    refusal(
      c.consume('session', 7, 1),
      'unauthenticated',
      'identity.challenge_rejected',
    );
    refusal(
      c.consume(purpose, 7, 100),
      'unauthenticated',
      'identity.challenge_rejected',
    );
    refusal(c.consume(purpose, 7, -1), 'invalid', 'identity.challenge_invalid');
    const invalid = value(used.invalidate(10)),
      again = value(invalid.invalidate(20));
    expect(again.snapshot().consumedAtMs).toBe(0);
    expect(again.snapshot().invalidatedAtMs).toBe(10);
  }
});
it('auth challenge restore keeps invalidation and snapshot ownership', () => {
  const seed = { ...challengeSeed('password_reset'), invalidatedAtMs: 0 },
    c = value(Challenge.restore(seed));
  seed.invalidatedAtMs = 10;
  const out = c.snapshot();
  out.invalidatedAtMs = 11;
  expect(c.snapshot().invalidatedAtMs).toBe(0);
  refusal(
    c.consume('password_reset', 7, 0),
    'unauthenticated',
    'identity.challenge_rejected',
  );
});
it('auth challenge refuses corrupt snapshots and forged instances', () => {
  const seed = challengeSeed('password_reset');
  for (const changes of [
    { id: 'bad' },
    { passwordVersion: 0 },
    { passwordVersion: 2147483648 },
    { issuedAtMs: -1 },
    { expiresAtMs: 0 },
    { consumedAtMs: 100 },
    { invalidatedAtMs: -1 },
    { expiresAtMs: 253402300800000 },
    { consumedAtMs: null },
    { issuedAtMs: NaN },
  ])
    refusal(
      Challenge.restore({ ...seed, ...changes } as ChallengeSnapshot),
      'invalid',
      'identity.challenge_invalid',
    );
  refusal(
    Challenge.restore({ ...seed, tokenDigest: digest('session') }),
    'invalid',
    'identity.challenge_invalid',
  );
  const forged = Reflect.construct(Challenge, [
    { ...seed, passwordVersion: 0 },
  ]) as Challenge;
  refusal(
    forged.consume('password_reset', 0, 0),
    'invalid',
    'identity.challenge_invalid',
  );
});
