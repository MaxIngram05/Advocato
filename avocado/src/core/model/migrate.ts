import { CaseFileSchema, CURRENT_SCHEMA_VERSION, type CaseFile } from './index';

export class UnsupportedSchemaVersionError extends Error {
  constructor(version: unknown) {
    super(`Unsupported case file schema version: ${String(version)}`);
    this.name = 'UnsupportedSchemaVersionError';
  }
}

type Doc = Record<string, unknown>;
export type Migration = (doc: Doc) => Doc;

/** Step n upgrades a document from version n to n + 1. None needed yet. */
export const MIGRATIONS: Record<number, Migration> = {};

export function runMigrations(doc: Doc, steps: Record<number, Migration>, target: number): Doc {
  let current = doc;
  let version = current.schemaVersion;
  while (typeof version === 'number' && version < target) {
    const step = steps[version];
    if (!step) throw new UnsupportedSchemaVersionError(version);
    current = step(current);
    if (current.schemaVersion !== version + 1) {
      throw new Error(`Migration from version ${version} did not advance the schema version`);
    }
    version = current.schemaVersion;
  }
  return current;
}

/** Upgrades a stored case file to the current schema and validates it. */
export function migrate(raw: unknown): CaseFile {
  const doc = (raw ?? {}) as Doc;
  const version = doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(version);
  }
  return CaseFileSchema.parse(runMigrations(doc, MIGRATIONS, CURRENT_SCHEMA_VERSION));
}
