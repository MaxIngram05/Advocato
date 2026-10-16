import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, newCaseFile } from '../../../../src/core/model';
import { migrate, runMigrations, UnsupportedSchemaVersionError } from '../../../../src/core/model/migrate';

describe('§12 schema versioning', () => {
  it('passes a current-version case through and validates it', () => {
    const c = newCaseFile({ id: 'c', docId: 'd', lang: 'fr' });
    expect(migrate(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('rejects a document from a newer version of the app', () => {
    const c = { ...newCaseFile({ id: 'c', docId: 'd', lang: 'fr' }), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrate(c)).toThrow(UnsupportedSchemaVersionError);
  });

  it('rejects a document without a version', () => {
    expect(() => migrate({ id: 'c' })).toThrow(UnsupportedSchemaVersionError);
  });

  it('rejects a document that fails the schema after migration', () => {
    expect(() => migrate({ schemaVersion: CURRENT_SCHEMA_VERSION, id: 3 })).toThrow();
  });

  it('applies each migration step in order', () => {
    const steps = {
      1: (d: Record<string, unknown>) => ({ ...d, a: 1, schemaVersion: 2 }),
      2: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1, schemaVersion: 3 }),
    };
    expect(runMigrations({ schemaVersion: 1 }, steps, 3)).toEqual({ schemaVersion: 3, a: 1, b: 2 });
  });

  it('fails when a migration step is missing', () => {
    expect(() => runMigrations({ schemaVersion: 1 }, {}, 2)).toThrow(UnsupportedSchemaVersionError);
  });

  it('fails when a step does not advance the version', () => {
    const steps = { 1: (d: Record<string, unknown>) => d };
    expect(() => runMigrations({ schemaVersion: 1 }, steps, 2)).toThrow(/did not advance/);
  });
});
