import { useState } from 'react';
import type { CaseFile } from '../../core/model';
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
      let current = caseFile;
      for (const exhibit of current.exhibits.filter((e) => !e.factsExtracted)) {
        onBusy(t('upload.analysing', { id: exhibit.id }));
        current = (await gateway.extractFacts(current, exhibit.id)).caseFile;
        onCaseFile(current);
      }
      onBusy(t('upload.finishing'));
      onCaseFile((await gateway.finishIngestion(current)).caseFile);
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
