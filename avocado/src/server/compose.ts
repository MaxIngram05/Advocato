import { AugureLlmClient } from '../adapters/augure/AugureLlmClient';
import { GasCaseRepository } from '../adapters/gas/GasCaseRepository';
import { readSelectionText, type SelectionLike } from '../adapters/gas/GasDocumentWriter';
import { GasDriveRest } from '../adapters/gas/GasDriveRest';
import { GasExhibitStore } from '../adapters/gas/GasExhibitStore';
import { GasHttpClient } from '../adapters/http/GasHttpClient';
import { AvocadoService } from '../application/AvocadoService';
import type { DocumentWriter } from '../ports';

/** Apps Script composition root (§9.1): the only place that touches GAS globals. */
export function composeServer(): AvocadoService {
  const props = PropertiesService.getScriptProperties();
  const prop = (key: string, fallback: string) => props.getProperty(key) || fallback;
  const drive = new GasDriveRest(UrlFetchApp, () => ScriptApp.getOAuthToken());
  const doc = () => DocumentApp.getActiveDocument();
  const writer: DocumentWriter = {
    upsertSection: () => Promise.reject(new Error('Document writing arrives in M9')),
    removeRanges: () => Promise.reject(new Error('Document writing arrives in M9')),
    readSelection: async () => readSelectionText(doc().getSelection() as unknown as SelectionLike | null),
  };
  return new AvocadoService({
    repo: new GasCaseRepository({
      drive,
      propertiesFor: () => PropertiesService.getDocumentProperties(),
      docTitle: () => doc().getName(),
    }),
    exhibits: new GasExhibitStore({ drive }),
    llm: new AugureLlmClient({
      http: new GasHttpClient(UrlFetchApp),
      config: {
        apiKey: prop('AUGURE_API_KEY', ''),
        baseUrl: prop('AUGURE_BASE_URL', 'https://api.augureai.ca/v1'),
        model: prop('AUGURE_MODEL', 'ossington-4-1'),
        longContextModel: prop('AUGURE_LONG_CONTEXT_MODEL', 'rosedale-1'),
      },
      sleep: async (ms) => Utilities.sleep(ms),
    }),
    writer,
    ids: { next: (prefix) => `${prefix}-${Utilities.getUuid().slice(0, 8)}` },
    clock: { now: () => new Date() },
    docId: () => doc().getId(),
  });
}
