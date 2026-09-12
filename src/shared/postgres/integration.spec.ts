import { expect, it } from 'vitest';
import { Database } from './index.js';
import { SecretString } from '../secret/index.js';
import { err, failure, ok } from '../errors/index.js';
it.skipIf(!process.env.N2F_TEST_DATABASE_URL)(
  'real PostgreSQL migrations and transaction outcomes',
  async () => {
    const opened = await Database.open({
      url: new SecretString(process.env.N2F_TEST_DATABASE_URL!),
      maxConnections: 4,
      timeoutMs: 1000,
    });
    if (!opened.ok) throw Error('database startup failed');
    const db = opened.value;
    try {
      const ms = [
        {
          version: 1,
          sql: 'CREATE TABLE n2f_fixture (id integer PRIMARY KEY, value text NOT NULL)',
        },
      ];
      expect((await db.migrate(ms)).ok).toBe(true);
      expect((await db.migrate(ms)).ok).toBe(true);
      const changed = await db.migrate([{ version: 1, sql: ms[0].sql + ' ' }]);
      expect(changed.ok).toBe(false);
      if (!changed.ok)
        expect(changed.error.type).toBe('database.migration_drift');
      expect(
        (
          await db.migrate([
            ...ms,
            {
              version: 2,
              sql: 'CREATE TABLE n2f_rolled_migration (id int); SELECT 1/0',
            },
          ])
        ).ok,
      ).toBe(false);
      expect(
        await db.transaction(async (tx) =>
          ok(
            (
              await tx.query(
                "SELECT to_regclass('public.n2f_rolled_migration')::text AS name",
              )
            ).rows[0].name,
          ),
        ),
      ).toEqual({ ok: true, value: null });
      expect(
        (
          await db.transaction(async (tx) => {
            await tx.query("INSERT INTO n2f_fixture VALUES(1,'committed')");
            return ok(undefined);
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await db.transaction(async (tx) => {
            await tx.query("INSERT INTO n2f_fixture VALUES(2,'rollback')");
            return err(failure('conflict', 'fixture refusal'));
          })
        ).ok,
      ).toBe(false);
      expect(
        (
          await db.transaction(async (tx) => {
            try {
              await tx.query('SELECT 1/0');
            } catch {
              /* swallowed on purpose */
            }
            return ok(undefined);
          })
        ).ok,
      ).toBe(false);
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          db.transaction(async (tx) => {
            await tx.query("INSERT INTO n2f_fixture VALUES($1,'parallel')", [
              i + 10,
            ]);
            return ok(undefined);
          }),
        ),
      );
      expect(results.every((r) => r.ok)).toBe(true);
      expect(
        await db.transaction(async (tx) =>
          ok(
            (await tx.query('SELECT count(*) FROM n2f_fixture')).rows[0].count,
          ),
        ),
      ).toEqual({ ok: true, value: '9' });
      const started = performance.now();
      expect(
        (
          await db.transaction(async (tx) => {
            await tx.query('SELECT pg_sleep(2)');
            return ok(undefined);
          })
        ).ok,
      ).toBe(false);
      expect(performance.now() - started).toBeLessThan(2000);
      expect((await db.close(1000)).ok).toBe(true);
      expect((await db.ping()).ok).toBe(false);
    } finally {
      await db.close(1000);
    }
  },
  15000,
);
