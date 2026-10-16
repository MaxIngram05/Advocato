import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../../src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

const FORBIDDEN_IN_PURE_LAYERS = [
  /from ['"][^'"]*\/(adapters|server|ui|dev|application)\//,
  /from ['"]react/,
  /from ['"]openai/,
  /\b(UrlFetchApp|DocumentApp|PropertiesService|DriveApp|HtmlService|SpreadsheetApp)\b/,
  /\bfetch\(/,
];

describe('§17 core is pure (no adapters, server, ui, GAS globals, fetch, React, LLM SDKs)', () => {
  for (const layer of ['core', 'ports']) {
    it(`${layer}/ has no forbidden imports or globals`, () => {
      const offenders = files(join(SRC, layer)).flatMap((f) => {
        const text = readFileSync(f, 'utf8');
        return FORBIDDEN_IN_PURE_LAYERS.filter((re) => re.test(text)).map(
          (re) => `${relative(SRC, f)} matches ${re}`,
        );
      });
      expect(offenders).toEqual([]);
    });
  }

  it('application/ only depends on core, ports and llm', () => {
    const offenders = files(join(SRC, 'application')).flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return FORBIDDEN_IN_PURE_LAYERS.filter((re) => !re.source.includes('application') && re.test(text)).map(
        (re) => `${relative(SRC, f)} matches ${re}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});
