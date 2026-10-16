import { useState } from 'react';
import { segmentParagraphs } from '../../core/exhibits/segments';
import type { CaseFile } from '../../core/model';
import type { ExtractedDocument } from '../../ports';
import { UploadDropzone } from '../components/UploadDropzone';
import { describeError } from '../errors';
import { extensionOf, type ExtractorRegistry } from '../extraction/ExtractorRegistry';
import type { ServerGateway } from '../gateway/ServerGateway';
import { useT } from '../i18n';

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

const isPdf = (file: File) => file.type === 'application/pdf' || extensionOf(file.name) === 'pdf';

export interface UploadStepProps {
  caseFile: CaseFile;
  gateway: ServerGateway;
  extractors: ExtractorRegistry;
  onCaseFile: (c: CaseFile) => void;
  /** Progress line shown with the loading wheel (empty = idle). */
  onBusy?: (status: string) => void;
}

/** US-03/US-04 container: extracts text in the sidebar, then the server numbers exhibits and extracts facts. */
export function UploadStep({ caseFile, gateway, extractors, onCaseFile, onBusy }: UploadStepProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [status, setStatusState] = useState('');
  const setStatus = (s: string) => {
    setStatusState(s);
    onBusy?.(s);
  };
  const [problems, setProblems] = useState<string[]>([]);

  const run = async (work: (issues: string[]) => Promise<void>) => {
    setBusy(true);
    setStatus(t('upload.working'));
    const issues: string[] = [];
    try {
      await work(issues);
    } catch (e) {
      issues.push(describeError(t, e));
    } finally {
      setProblems(issues);
      setStatus('');
      setBusy(false);
    }
  };

  const ingest = async (current: CaseFile, docs: ExtractedDocument[], issues: string[]): Promise<CaseFile> => {
    if (docs.length === 0) return current;
    const update = await gateway.ingestDocuments(current, docs);
    onCaseFile(update.caseFile);
    issues.push(...update.alerts.filter((a) => a.severity !== 'info').map((a) => a.message));
    return update.caseFile;
  };

  const onFiles = (files: File[]) =>
    run(async (issues) => {
      let current = caseFile;
      const docs: ExtractedDocument[] = [];
      for (const file of files) {
        const result = await extractors.extract({ name: file.name, mime: file.type, size: file.size, bytes: () => readBytes(file) });
        if (result.ok) {
          docs.push({
            name: file.name,
            mime: file.type || 'application/octet-stream',
            segments: result.segments,
            ...(result.pages ? { pages: result.pages } : {}),
          });
        } else if (result.reason === 'no-text' && isPdf(file)) {
          setStatus(t('upload.transcribing', { name: file.name }));
          const update = await gateway.transcribePdf(current, { name: file.name, base64: toBase64(await readBytes(file)) });
          current = update.caseFile;
          onCaseFile(current);
        } else {
          issues.push(t('upload.failed', { name: file.name, reason: t(`upload.reason.${result.reason}`) }));
        }
      }
      await ingest(current, docs, issues);
    });

  const onUseSelection = () =>
    run(async (issues) => {
      const segments = segmentParagraphs(await gateway.readSelection());
      if (segments.length === 0) {
        issues.push(t('upload.nothingSelected'));
        return;
      }
      await ingest(caseFile, [{ name: t('upload.selectionName'), mime: 'text/plain', segments }], issues);
    });

  const onAnalyse = () =>
    run(async () => {
      let current = caseFile;
      for (const exhibit of current.exhibits.filter((e) => !e.factsExtracted)) {
        setStatus(t('upload.analysing', { id: exhibit.id }));
        current = (await gateway.extractFacts(current, exhibit.id)).caseFile;
        onCaseFile(current);
      }
      setStatus(t('upload.finishing'));
      onCaseFile((await gateway.finishIngestion(current)).caseFile);
    });

  return (
    <>
      <UploadDropzone
        exhibits={caseFile.exhibits}
        problems={problems}
        busy={busy}
        onFiles={(f) => void onFiles(f)}
        onUseSelection={() => void onUseSelection()}
      />
      <div className="av-panel">
        {status && <p className="av-visually-hidden">{status}</p>}
        <button type="button" disabled={busy || caseFile.exhibits.length === 0} onClick={() => void onAnalyse()}>
          {t('upload.analyse')}
        </button>
      </div>
    </>
  );
}
