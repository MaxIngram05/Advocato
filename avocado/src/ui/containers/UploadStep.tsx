import { useState } from 'react';
import { segmentParagraphs } from '../../core/exhibits/segments';
import type { CaseFile } from '../../core/model';
import type { ExtractedDocument } from '../../ports';
import { UploadDropzone } from '../components/UploadDropzone';
import type { ExtractorRegistry } from '../extraction/ExtractorRegistry';
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

export interface UploadStepProps {
  caseFile: CaseFile;
  gateway: ServerGateway;
  extractors: ExtractorRegistry;
  onCaseFile: (c: CaseFile) => void;
}

/** US-03 container: extracts in the sidebar, then hands the text to the server. */
export function UploadStep({ caseFile, gateway, extractors, onCaseFile }: UploadStepProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const ingest = async (docs: ExtractedDocument[], issues: string[]) => {
    if (docs.length > 0) {
      const update = await gateway.ingestDocuments(caseFile, docs);
      onCaseFile(update.caseFile);
      issues.push(...update.alerts.filter((a) => a.severity !== 'info').map((a) => a.message));
    }
    setProblems(issues);
  };

  const onFiles = async (files: File[]) => {
    setBusy(true);
    const docs: ExtractedDocument[] = [];
    const issues: string[] = [];
    for (const file of files) {
      const result = await extractors.extract({
        name: file.name,
        mime: file.type,
        size: file.size,
        bytes: () => readBytes(file),
      });
      if (result.ok) {
        docs.push({
          name: file.name,
          mime: file.type || 'application/octet-stream',
          segments: result.segments,
          ...(result.pages ? { pages: result.pages } : {}),
        });
      } else {
        issues.push(t('upload.failed', { name: file.name, reason: t(`upload.reason.${result.reason}`) }));
      }
    }
    try {
      await ingest(docs, issues);
    } finally {
      setBusy(false);
    }
  };

  const onUseSelection = async () => {
    setBusy(true);
    try {
      const segments = segmentParagraphs(await gateway.readSelection());
      if (segments.length === 0) {
        setProblems([t('upload.nothingSelected')]);
        return;
      }
      await ingest([{ name: t('upload.selectionName'), mime: 'text/plain', segments }], []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <UploadDropzone
      exhibits={caseFile.exhibits}
      problems={problems}
      busy={busy}
      onFiles={(f) => void onFiles(f)}
      onUseSelection={() => void onUseSelection()}
    />
  );
}
