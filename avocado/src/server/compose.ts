import { AugureLlmClient } from '../adapters/augure/AugureLlmClient';
import { GasCaseRepository } from '../adapters/gas/GasCaseRepository';
import { CaijSearch } from '../adapters/caij/CaijSearch';
import { GasDocumentWriter } from '../adapters/gas/GasDocumentWriter';
import { GasDriveRest } from '../adapters/gas/GasDriveRest';
import { GasExhibitStore } from '../adapters/gas/GasExhibitStore';
import { GasHttpClient } from '../adapters/http/GasHttpClient';
import { AvocadoService } from '../application/AvocadoService';

/** Apps Script composition root (§9.1): the only place that touches GAS globals. */
export function composeServer(): AvocadoService {
  const props = PropertiesService.getScriptProperties();
  const prop = (key: string, fallback: string) => props.getProperty(key) || fallback;
  const drive = new GasDriveRest(UrlFetchApp, () => ScriptApp.getOAuthToken());
  const doc = () => DocumentApp.getActiveDocument();
  const writer = new GasDocumentWriter(doc);
  const http = new GasHttpClient(UrlFetchApp);
  return new AvocadoService({
    repo: new GasCaseRepository({
      drive,
      propertiesFor: () => PropertiesService.getDocumentProperties(),
      docTitle: () => doc().getName(),
    }),
    exhibits: new GasExhibitStore({ drive }),
    llm: new AugureLlmClient({
      http,
      config: {
        apiKey: prop('AUGURE_API_KEY', ''),
        baseUrl: prop('AUGURE_BASE_URL', 'https://api.augureai.ca/v1'),
        model: prop('AUGURE_MODEL', 'ossington-5'),
        longContextModel: prop('AUGURE_LONG_CONTEXT_MODEL', 'rosedale-1'),
      },
      sleep: async (ms) => Utilities.sleep(ms),
    }),
    writer,
    // Compagnon (CAIJ semantic search): used only to find precedents and sources for the argument.
    search: new CaijSearch(http, prop('COMPAGNON_API_URL', prop('CAIJ_BASE_URL', 'https://hackathon.caij.qc.ca')).trim().replace(/\/+$/, '')),
    ids: { next: (prefix) => `${prefix}-${Utilities.getUuid().slice(0, 8)}` },
    clock: { now: () => new Date() },
    docId: () => doc().getId(),
  });
}
