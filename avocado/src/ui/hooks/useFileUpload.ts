import { segmentParagraphs } from '../../core/exhibits/segments';
import type { CaseFile } from '../../core/model';
import type { ExtractedDocument } from '../../ports';
import { describeError } from '../errors';
import { extensionOf, type ExtractorRegistry } from '../extraction/ExtractorRegistry';
import type { ServerGateway } from '../gateway/ServerGateway';

const readBytes = (file: File): Promise<ArrayBuffer> =>
  typeof file.arrayBuffer === 'function'
    ? file.arrayBuffer()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

export interface UploadDeps {
  getCase: () => CaseFile;
  gateway: ServerGateway;
  extractors: ExtractorRegistry;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onCaseFile: (c: CaseFile) => void;
  onStatus: (s: string) => void;
  onProblems: (p: string[]) => void;
}

/** File and selection intake, available at every step (exhibits are held until the stance is confirmed). */
export function makeUploader(deps: UploadDeps) {
  const { gateway, extractors, t } = deps;

  const run = async (work: (issues: string[]) => Promise<void>) => {
    const issues: string[] = [];
    deps.onStatus(t('upload.working'));
    try {
      await work(issues);
    } catch (e) {
      issues.push(describeError(t, e));
    } finally {
      deps.onProblems(issues);
      deps.onStatus('');
    }
  };

  const ingest = async (current: CaseFile, docs: ExtractedDocument[], issues: string[]) => {
    if (docs.length === 0) return current;
    const update = await gateway.ingestDocuments(current, docs);
    deps.onCaseFile(update.caseFile);
    issues.push(...update.alerts.filter((a) => a.severity !== 'info').map((a) => a.message));
    return update.caseFile;
  };

  const uploadFiles = (files: File[]) =>
    run(async (issues) => {
      let current = deps.getCase();
      const docs: ExtractedDocument[] = [];
      for (const file of files) {
        const result = await extractors.extract({ name: file.name, mime: file.type, size: file.size, bytes: () => readBytes(file) });
        if (result.ok) {
          docs.push({ name: file.name, mime: file.type || 'application/octet-stream', segments: result.segments, ...(result.pages ? { pages: result.pages } : {}) });
        } else if (result.reason === 'no-text' && (file.type === 'application/pdf' || extensionOf(file.name) === 'pdf') && current.stance) {
          deps.onStatus(t('upload.transcribing', { name: file.name }));
          current = (await gateway.transcribePdf(current, { name: file.name, base64: toBase64(await readBytes(file)) })).caseFile;
          deps.onCaseFile(current);
        } else {
          issues.push(t('upload.failed', { name: file.name, reason: t(`upload.reason.${result.reason}`) }));
        }
      }
      await ingest(current, docs, issues);
    });

  const useSelection = () =>
    run(async (issues) => {
      const segments = segmentParagraphs(await gateway.readSelection());
      if (segments.length === 0) {
        issues.push(t('upload.nothingSelected'));
        return;
      }
      await ingest(deps.getCase(), [{ name: t('upload.selectionName'), mime: 'text/plain', segments }], issues);
    });

  return { uploadFiles, useSelection };
}
