import { ScriptedLlmClient } from '../../src/adapters/fake/ScriptedLlmClient';
import { AugureLlmClient } from '../../src/adapters/augure/AugureLlmClient';
import { FetchHttpClient } from '../../src/adapters/http/FetchHttpClient';
import { liveConfig } from '../helpers/liveConfig';
import { llmClientContract } from './LlmClient.contract';

llmClientContract('scripted fake', (answers) => new ScriptedLlmClient({ detectMissingInfo: answers }));

llmClientContract(
  'Augure over a canned HTTP response',
  (answers) =>
    new AugureLlmClient({
      http: {
        request: async () => ({
          status: 200,
          headers: {},
          body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(answers[0]) }, finish_reason: 'stop' }] }),
        }),
      },
      config: { apiKey: 'k', baseUrl: 'https://api.augureai.ca/v1', model: 'ossington-4-1', longContextModel: 'rosedale-1' },
      sleep: async () => undefined,
    }),
);

const live = liveConfig();
if (live) {
  llmClientContract(
    'Augure (LIVE)',
    () =>
      new AugureLlmClient({
        http: new FetchHttpClient(),
        config: live.augure,
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      }),
    { live: true },
  );
}
