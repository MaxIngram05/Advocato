import type { CaseFile, StanceSuggestion } from '../../core/model';
import type { ExtractedDocument } from '../../ports';
import type { CaseUpdate, ServerGateway } from './ServerGateway';

export type RpcCall = (method: string, argsJson: string) => Promise<unknown>;

/** ServerGateway over a generic JSON RPC call (Apps Script or in-process). */
export class RpcGateway implements ServerGateway {
  constructor(private readonly call: RpcCall) {}

  private invoke<T>(method: string, ...args: unknown[]): Promise<T> {
    return this.call(method, JSON.stringify(args)) as Promise<T>;
  }

  loadCase(): Promise<CaseFile> {
    return this.invoke('loadCase');
  }
  async saveCase(caseFile: CaseFile): Promise<void> {
    await this.invoke('saveCase', caseFile);
  }
  suggestStance(caseFile: CaseFile): Promise<StanceSuggestion | null> {
    return this.invoke('suggestStance', caseFile);
  }
  ingestDocuments(caseFile: CaseFile, docs: ExtractedDocument[]): Promise<CaseUpdate> {
    return this.invoke('ingestDocuments', caseFile, docs);
  }
  transcribePdf(caseFile: CaseFile, pdf: { name: string; base64: string }): Promise<CaseUpdate> {
    return this.invoke('transcribePdf', caseFile, pdf);
  }
  extractFacts(caseFile: CaseFile, exhibitId: string): Promise<CaseUpdate> {
    return this.invoke('extractFacts', caseFile, exhibitId);
  }
  finishIngestion(caseFile: CaseFile): Promise<CaseUpdate> {
    return this.invoke('finishIngestion', caseFile);
  }
  analyseCase(caseFile: CaseFile): Promise<CaseUpdate> {
    return this.invoke('analyseCase', caseFile);
  }
  converse(caseFile: CaseFile, message: string): Promise<CaseUpdate> {
    return this.invoke('converse', caseFile, message);
  }
  readSelection(): Promise<string> {
    return this.invoke('readSelection');
  }
}
