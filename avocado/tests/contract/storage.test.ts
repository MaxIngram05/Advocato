import { describe, expect, it } from 'vitest';
import { InMemoryCaseRepository } from '../../src/adapters/fake/InMemoryCaseRepository';
import { InMemoryExhibitStore } from '../../src/adapters/fake/InMemoryExhibitStore';
import { GasCaseRepository } from '../../src/adapters/gas/GasCaseRepository';
import { GasExhibitStore } from '../../src/adapters/gas/GasExhibitStore';
import { newCaseFile } from '../../src/core/model';
import { FakeDrive, fakeDocumentProperties } from '../helpers/gasMocks';
import { caseRepositoryContract } from './CaseRepository.contract';
import { exhibitStoreContract } from './ExhibitStore.contract';

caseRepositoryContract('in-memory fake', () => new InMemoryCaseRepository());
caseRepositoryContract(
  'GAS (Drive + DocumentProperties, mocked globals)',
  () => new GasCaseRepository({ drive: new FakeDrive(), propertiesFor: fakeDocumentProperties(), docTitle: () => 'Dossier' }),
);
exhibitStoreContract('in-memory fake', () => new InMemoryExhibitStore());
exhibitStoreContract('GAS (Drive, mocked globals)', () => new GasExhibitStore({ drive: new FakeDrive() }));

describe('§12 GasCaseRepository specifics', () => {
  it('stores the case JSON in a Drive file named after the document and links it from DocumentProperties', async () => {
    const drive = new FakeDrive();
    const propertiesFor = fakeDocumentProperties();
    const repo = new GasCaseRepository({ drive, propertiesFor, docTitle: () => 'Vente Tremblay' });
    await repo.save(newCaseFile({ id: 'c1', docId: 'doc-9', lang: 'fr' }));
    const fileId = propertiesFor('doc-9').getProperty('avocado.caseFileId');
    expect(fileId).toBeTruthy();
    const file = drive.files.get(fileId as string);
    expect(file?.name).toBe('Avocado – Vente Tremblay – doc-9.json');
    expect(file?.mime).toBe('application/json');
    expect(JSON.parse(file?.content ?? '{}').id).toBe('c1');
  });

  it('reuses the same Drive file on later saves', async () => {
    const drive = new FakeDrive();
    const repo = new GasCaseRepository({ drive, propertiesFor: fakeDocumentProperties(), docTitle: () => 'D' });
    await repo.save(newCaseFile({ id: 'c1', docId: 'doc-1', lang: 'fr' }));
    await repo.save(newCaseFile({ id: 'c1', docId: 'doc-1', lang: 'en' }));
    expect(drive.files.size).toBe(1);
  });

  it('recreates the file when the linked Drive file has disappeared', async () => {
    const drive = new FakeDrive();
    const propertiesFor = fakeDocumentProperties();
    const repo = new GasCaseRepository({ drive, propertiesFor, docTitle: () => 'D' });
    propertiesFor('doc-1').setProperty('avocado.caseFileId', 'gone');
    expect(await repo.load('doc-1')).toBeNull();
    await repo.save(newCaseFile({ id: 'c1', docId: 'doc-1', lang: 'fr' }));
    expect((await repo.load('doc-1'))?.id).toBe('c1');
  });

  it('migrates on load', async () => {
    const drive = new FakeDrive();
    const propertiesFor = fakeDocumentProperties();
    const repo = new GasCaseRepository({ drive, propertiesFor, docTitle: () => 'D' });
    const file = drive.createFile('x', JSON.stringify({ id: 'c1', schemaVersion: 999 }), 'application/json');
    propertiesFor('doc-1').setProperty('avocado.caseFileId', file.getId());
    await expect(repo.load('doc-1')).rejects.toThrow(/schema version/i);
  });
});
