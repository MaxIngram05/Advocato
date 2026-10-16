import { segmentParagraphs } from '../../core/exhibits/segments';
import type { CaseFile } from '../../core/model';
import type { ExtractedDocument } from '../../ports';
import { mergeExtractions } from '../../core/facts/mergeExtractions';
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
  /** Adds a chat message, so every upload gets an immediate visible reply. */
  onSay: (role: 'user' | 'bot', text: string) => void;
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

  const uploadFiles = (files: File[]) => {
    if (files.length === 0) return Promise.resolve();
    deps.onSay('user', files.map((f) => `📎 ${f.name}`).join('\n'));
    deps.onSay('bot', t('upload.receiving', { count: files.length }));
    return run(async (issues) => {
      let current = deps.getCase();
      const before = new Set(current.exhibits.map((e) => e.id));
      const heldBefore = ((current.pendingDocs as unknown[] | undefined) ?? []).length;
      const docs: ExtractedDocument[] = [];
      for (const file of files) {
        deps.onStatus(t('upload.reading', { name: file.name }));
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
      let after = await ingest(current, docs, issues);
      const added = after.exhibits.filter((e) => !before.has(e.id));
      const held = ((after.pendingDocs as unknown[] | undefined) ?? []).length - heldBefore;
      if (added.length > 0) {
        deps.onSay('bot', [t('upload.received', { count: added.length }), ...added.map((e) => `• ${e.id} — ${e.name}${e.pages ? ` (${e.pages} p.)` : ''}`)].join('\n'));
      } else if (held > 0) {
        deps.onSay('bot', t('upload.heldReply', { count: held }));
      } else if (issues.length > 0) {
        deps.onSay('bot', t('upload.noneUsable'));
      }
      if (after.stance && after.exhibits.some((e) => !e.factsExtracted)) after = await extractPending(after);
    });
  };

  const useSelection = () =>
    run(async (issues) => {
      const segments = segmentParagraphs(await gateway.readSelection());
      if (segments.length === 0) {
        issues.push(t('upload.nothingSelected'));
        return;
      }
      await ingest(deps.getCase(), [{ name: t('upload.selectionName'), mime: 'text/plain', segments }], issues);
    });

  /**
   * Extracts facts from every exhibit not analysed yet (in parallel), then opens or refreshes
   * the fact checklist, so facts are laid out right after the upload.
   */
  const extractPending = async (base: CaseFile): Promise<CaseFile> => {
    const pendingIds = base.exhibits.filter((e) => !e.factsExtracted).map((e) => e.id);
    let current = base;
    if (pendingIds.length > 0) {
      deps.onStatus(t('upload.analysing', { id: pendingIds.join(', ') }));
      const settled = await Promise.allSettled(pendingIds.map((id) => gateway.extractFacts(base, id)));
      current = mergeExtractions(base, settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value.caseFile] : [])));
      const newIds = current.facts.filter((f) => !base.facts.some((b) => b.id === f.id)).map((f) => f.id);
      if (current.session.step !== 'INTAKE' && current.session.step !== 'UPLOAD' && newIds.length > 0) {
        current = {
          ...current,
          session: { ...current.session, allFactIds: [...current.session.allFactIds, ...newIds], factPool: [...current.session.factPool, ...newIds] },
        };
        deps.onSay('bot', t('facts.added', { count: newIds.length }));
      }
      deps.onCaseFile(current);
      const failed = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
      if (failed) {
        await gateway.saveCase(current);
        throw failed.reason;
      }
    }
    if (current.session.step === 'UPLOAD' && current.exhibits.length > 0 && current.exhibits.every((e) => e.factsExtracted)) {
      deps.onStatus(t('upload.finishing'));
      current = (await gateway.finishIngestion(current)).caseFile;
      deps.onCaseFile(current);
    } else {
      await gateway.saveCase(current);
    }
    return current;
  };

  /** Runs extraction with the usual status/problem reporting. */
  const reviewFacts = (base: CaseFile) =>
    run(async () => {
      await extractPending(base);
    });

  return { uploadFiles, useSelection, reviewFacts, extractPending };
}
