import { useState } from 'react';
import type { CaseFile } from '../../core/model';
import { mergeExtractions } from '../../core/facts/mergeExtractions';
import { describeError } from '../errors';
import type { ServerGateway } from '../gateway/ServerGateway';
import { useT } from '../i18n';

export interface UploadStepProps {
  caseFile: CaseFile;
  gateway: ServerGateway;
  onCaseFile: (c: CaseFile) => void;
  onBusy: (status: string) => void;
}

/** US-03/US-04 card: the exhibits received so far and the button that extracts their facts. */
export function UploadStep({ caseFile, gateway, onCaseFile, onBusy }: UploadStepProps) {
  const t = useT();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const analyse = async () => {
    setBusy(true);
    setError('');
    try {
      // All exhibits at once (one LLM call each), then merged with sequential fact ids.
      const pending = caseFile.exhibits.filter((e) => !e.factsExtracted).map((e) => e.id);
      onBusy(t('upload.analysing', { id: pending.join(', ') }));
      const settled = await Promise.allSettled(pending.map((id) => gateway.extractFacts(caseFile, id)));
      const ok = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value.caseFile] : []));
      const merged = mergeExtractions(caseFile, ok);
      onCaseFile(merged);
      const failed = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
      if (failed) {
        await gateway.saveCase(merged);
        throw failed.reason;
      }
      onBusy(t('upload.finishing'));
      onCaseFile((await gateway.finishIngestion(merged)).caseFile);
    } catch (e) {
      setError(describeError(t, e));
    } finally {
      onBusy('');
      setBusy(false);
    }
  };

  if (caseFile.exhibits.length === 0) return null;
  return (
    <div className="av-card">
      <ul className="av-exhibits" aria-label={t('upload.exhibits')}>
        {caseFile.exhibits.map((e) => (
          <li key={e.id}>
            <span className="av-exhibit-id">{e.id}</span> {e.name}
            {e.ocr ? ` (${t('upload.ocr')})` : ''}
            {e.factsExtracted ? ' ✓' : ''}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="av-alert" data-severity="critical">
          ⚠ {error}
        </p>
      )}
      <button type="button" className="av-primary" disabled={busy} onClick={() => void analyse()}>
        {t('upload.analyse')}
      </button>
    </div>
  );
}
