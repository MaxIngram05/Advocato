import { describe, expect, it } from 'vitest';
import en from '../../../src/ui/i18n/en.json';
import fr from '../../../src/ui/i18n/fr.json';
import { t } from '../../../src/ui/i18n';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('US-01 i18n', () => {
  it('fr.json and en.json have identical key sets', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('resolves nested keys per language', () => {
    expect(t('fr', 'greeting')).toBe('Bonjour, hi');
    expect(t('en', 'intake.title')).toBe('Case intake');
    expect(t('fr', 'intake.title')).toBe('Ouverture du dossier');
  });

  it('interpolates {vars}', () => {
    expect(t('en', 'stance.suggestion', { role: 'claimant', name: 'X' })).toContain('X');
  });

  it('returns the key itself when missing (visible, never silent)', () => {
    expect(t('en', 'nope.missing')).toBe('nope.missing');
  });

  it('has a question for every intake field', () => {
    for (const f of ['court', 'areaOfLaw', 'stance', 'objective', 'dateOfFacts', 'parties', 'documents']) {
      expect(t('fr', `intake.ask.${f}`)).not.toBe(`intake.ask.${f}`);
    }
  });
});
