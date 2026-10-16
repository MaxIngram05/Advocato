import { useEffect, useMemo, useRef, useState } from 'react';
import { detectLanguage } from '../core/language/LanguageDetector';
import { newCaseFile, type CaseFile, type ChatMessage, type Lang, type Stance } from '../core/model';
import logo from './assets/advocato.png';
import { Composer } from './components/Composer';
import { SettingsMenu } from './components/SettingsMenu';
import { Spinner } from './components/Spinner';
import { AnalysisStep } from './containers/AnalysisStep';
import { FactReviewStep } from './containers/FactReviewStep';
import { UploadStep } from './containers/UploadStep';
import { describeError } from './errors';
import type { ExtractorRegistry } from './extraction/ExtractorRegistry';
import type { ServerGateway } from './gateway/ServerGateway';
import { makeUploader } from './hooks/useFileUpload';
import { applyEvent, useCaseFile, type Clock } from './hooks/useCaseFile';
import { LangContext, t } from './i18n';
import './theme.css';

export interface AppProps {
  gateway: ServerGateway;
  clock: Clock;
  extractors: ExtractorRegistry;
  saveDelayMs?: number;
}

interface PendingStance {
  role: Stance['role'];
  clientName: string;
  opposingParties: string[];
  roleDescription?: string;
}

const LANG_KEY = 'advocato.lang';
const storedLang = (): Lang | undefined => {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === 'fr' || v === 'en' ? v : undefined;
  } catch {
    return undefined;
  }
};
const storeLang = (l: Lang) => {
  try {
    window.localStorage.setItem(LANG_KEY, l);
  } catch {
    /* private mode: the language is asked again next time */
  }
};

/** Status lines that depend on data (the conversation itself comes from the model). */
function stepIntro(c: CaseFile, lang: Lang): string | null {
  const fr = lang === 'fr';
  if (c.session.step === 'GREETING') return null;
  if (c.session.step === 'INTAKE' && c.messages.length === 0) {
    return fr
      ? 'Parlez-moi du dossier : qui représentez-vous, contre qui, devant quel tribunal et ce que vous cherchez à obtenir. Vous pouvez aussi joindre les pièces avec 📎.'
      : 'Tell me about the case: who you represent, against whom, before which court and what you want to obtain. You can also attach the exhibits with 📎.';
  }
  if (c.session.step === 'FACT_REVIEW') {
    return fr
      ? `J’ai extrait ${c.facts.length} faits, en ordre chronologique. Cochez ceux qui doivent porter l’argument principal.`
      : `I extracted ${c.facts.length} facts, in chronological order. Tick the ones the main argument should rest on.`;
  }
  return null;
}

export function App({ gateway, clock, extractors, saveDelayMs = 1000 }: AppProps) {
  const { caseFile, dispatch, update } = useCaseFile(gateway, clock, saveDelayMs);
  const [status, setStatus] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const caseRef = useRef<CaseFile | null>(null);
  caseRef.current = caseFile;
  const threadRef = useRef<HTMLElement>(null);
  const lang: Lang = caseFile?.session.lang ?? storedLang() ?? 'fr';
  const T = (k: string, v?: Record<string, string | number>) => t(lang, k, v);
  const step = caseFile?.session.step;

  // The language is asked once; later sessions reuse the remembered choice.
  useEffect(() => {
    const remembered = storedLang();
    if (caseFile && step === 'GREETING' && remembered) dispatch({ type: 'LANGUAGE_SET', lang: remembered });
  }, [caseFile, step, dispatch]);

  const intro = caseFile ? stepIntro(caseFile, lang) : null;
  useEffect(() => {
    if (!intro) return;
    update((c) => {
      const lastBot = [...c.messages].reverse().find((m) => m.role === 'bot');
      if (lastBot?.text === intro) return c;
      return { ...c, messages: [...c.messages, message('bot', intro)] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);

  const messageCount = caseFile?.messages.length ?? 0;
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, status, step, problems.length]);

  const uploader = useMemo(
    () =>
      makeUploader({
        getCase: () => caseRef.current as CaseFile,
        gateway,
        extractors,
        t: (k, v) => t(caseRef.current?.session.lang ?? 'fr', k, v),
        onCaseFile: (c) => update(() => c),
        onStatus: setStatus,
        onProblems: setProblems,
      }),
    [gateway, extractors, update],
  );

  function message(role: ChatMessage['role'], text: string): ChatMessage {
    return { id: `M-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, role, text, at: clock.now().toISOString() };
  }

  if (!caseFile) return <div className="av-app" aria-busy="true" />;
  const session = caseFile.session;
  const pending = !caseFile.stance ? (caseFile.pendingStance as PendingStance | undefined) : undefined;
  const pendingDocs = (caseFile.pendingDocs as { name: string }[] | undefined) ?? [];

  /** One chat turn: show the lawyer's message, then the model's reply. */
  const converse = async (base: CaseFile, text: string) => {
    const withMsg = { ...base, messages: [...base.messages, message('user', text)] };
    update(() => withMsg);
    setStatus(T('chat.thinking'));
    try {
      const out = await gateway.converse(withMsg, text);
      update(() => out.caseFile);
    } catch (e) {
      setProblems([describeError(T, e)]);
    } finally {
      setStatus('');
    }
  };

  const setLanguage = (l: Lang) => {
    storeLang(l);
    dispatch({ type: 'LANGUAGE_SET', lang: l });
  };

  const onSend = (text: string) => {
    setProblems([]);
    if (session.step === 'GREETING') {
      const detected = detectLanguage(text) ?? 'fr';
      storeLang(detected);
      void converse(applyEvent(caseFile, { type: 'LANGUAGE_SET', lang: detected }), text);
      return;
    }
    void converse(caseFile, text);
  };

  const confirmStance = (yes: boolean) => {
    if (!pending) return;
    const roleLabel = pending.role === 'other' ? (pending.roleDescription ?? '') : T(`stance.${pending.role}`).toLowerCase();
    if (!yes) {
      void converse({ ...caseFile, pendingStance: undefined }, T('stance.notRight'));
      return;
    }
    const stance: Stance = {
      role: pending.role,
      ...(pending.role === 'other' ? { roleDescription: pending.roleDescription || T('stance.other') } : {}),
      clientName: pending.clientName,
      opposingParties: pending.opposingParties,
      confirmedByUser: true,
      confirmedAt: clock.now().toISOString(),
    };
    const draftObjective = caseFile.intakeDraft?.objective;
    const confirmed = applyEvent({ ...caseFile, pendingStance: undefined, ...(draftObjective && !caseFile.objective ? { objective: draftObjective } : {}) }, { type: 'STANCE_CONFIRMED', stance });
    void converse(confirmed, T('stance.confirmedEcho', { name: stance.clientName, role: roleLabel }));
  };

  const newCase = () => {
    const fresh = newCaseFile({ id: `case-${Date.now().toString(36)}`, docId: caseFile.docId, lang });
    update(() => applyEvent(fresh, { type: 'LANGUAGE_SET', lang }));
    setProblems([]);
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="av-app" lang={lang}>
        <header className="av-header">
          <span className="av-logo">
            <img src={logo} alt="" width={30} height={30} />
            Advocato
          </span>
          <SettingsMenu lang={lang} onLanguage={setLanguage} onUseSelection={() => void uploader.useSelection()} onNewCase={newCase} />
        </header>
        <main ref={threadRef} className="av-thread" role="log" aria-live="polite" aria-label={T('chat.label')}>
          <ul className="av-messages">
            <li className="av-msg" data-message data-role="bot">
              <img className="av-avatar" src={logo} alt="" />
              <div className="av-bubble">
                <p>{T('greeting')}</p>
                {session.step === 'GREETING' && <p>Dans quelle langue souhaitez-vous travailler? / Which language would you like to work in?</p>}
              </div>
            </li>
            {caseFile.messages.map((m) => (
              <li key={m.id} className="av-msg" data-message data-role={m.role}>
                {m.role === 'bot' && <img className="av-avatar" src={logo} alt="" />}
                <div className="av-bubble">
                  {m.text.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {session.step === 'GREETING' && (
            <div className="av-chips" role="group" aria-label={T('language.label')}>
              <button type="button" onClick={() => setLanguage('fr')}>
                Français
              </button>
              <button type="button" onClick={() => setLanguage('en')}>
                English
              </button>
            </div>
          )}

          {pending && !status && (
            <div className="av-chips" role="group" aria-label={T('stance.confirmTitle')}>
              <button type="button" className="av-chip-strong" onClick={() => confirmStance(true)}>
                ✓ {T('stance.confirmChip', { name: pending.clientName, role: pending.role === 'other' ? (pending.roleDescription ?? '') : T(`stance.${pending.role}`).toLowerCase() })}
              </button>
              <button type="button" onClick={() => confirmStance(false)}>
                ✗ {T('stance.notRight')}
              </button>
            </div>
          )}

          {pendingDocs.length > 0 && (
            <div className="av-card av-card-muted">
              <p className="av-card-note">{T('upload.held')}</p>
              <ul className="av-exhibits">
                {pendingDocs.map((d, i) => (
                  <li key={`${d.name}-${i}`}>📄 {d.name}</li>
                ))}
              </ul>
            </div>
          )}

          {session.step === 'UPLOAD' && <UploadStep caseFile={caseFile} gateway={gateway} onBusy={setStatus} onCaseFile={(c) => update(() => c)} />}
          {session.step === 'FACT_REVIEW' && (
            <div className="av-card">
              <FactReviewStep
                key={session.round}
                caseFile={caseFile}
                onSelect={(factIds) =>
                  dispatch({ type: 'FACTS_SELECTED', factIds }, (c) => ({
                    ...c,
                    messages: [...c.messages, message('user', T('facts.selectedEcho', { count: factIds.length, ids: factIds.join(', ') }))],
                  }))
                }
              />
            </div>
          )}
          {session.step === 'ANALYSING' && (
            <div className="av-card av-card-doc">
              <AnalysisStep caseFile={caseFile} gateway={gateway} onCaseFile={(c) => update(() => c)} />
            </div>
          )}

          {problems.map((p) => (
            <p key={p} role="alert" className="av-alert" data-severity="warning">
              ⚠ {p}
            </p>
          ))}
          {status && <Spinner label={status} />}
        </main>
        <Composer onSend={onSend} onFiles={(f) => void uploader.uploadFiles(f)} disabled={!!status} />
      </div>
    </LangContext.Provider>
  );
}
