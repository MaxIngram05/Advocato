import { useEffect, useRef, useState } from 'react';
import { detectLanguage } from '../core/language/LanguageDetector';
import type { CaseFile, Lang, Stance, StanceSuggestion } from '../core/model';
import logo from './assets/advocato.png';
import { ChatInput } from './components/ChatInput';
import { LanguageToggle } from './components/LanguageToggle';
import { Spinner } from './components/Spinner';
import { StepIndicator } from './components/StepIndicator';
import { AnalysisStep } from './containers/AnalysisStep';
import { FactReviewStep } from './containers/FactReviewStep';
import { UploadStep } from './containers/UploadStep';
import { applyAnswer, nextQuestion, type Chip } from './conversation/intake';
import type { ExtractorRegistry } from './extraction/ExtractorRegistry';
import type { ServerGateway } from './gateway/ServerGateway';
import { useCaseFile, type Clock } from './hooks/useCaseFile';
import { LangContext, t } from './i18n';
import './theme.css';

export interface AppProps {
  gateway: ServerGateway;
  clock: Clock;
  extractors: ExtractorRegistry;
  saveDelayMs?: number;
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
    /* private mode: ask again next time */
  }
};

/** Bot line that opens each step of the conversation. */
function stepIntro(c: CaseFile, lang: Lang): string | null {
  const fr = lang === 'fr';
  switch (c.session.step) {
    case 'UPLOAD':
      return fr
        ? 'Parfait, le dossier est ouvert. Envoyez-moi les pièces (PDF, DOCX ou TXT) avec le trombone 📎, ou utilisez le texte sélectionné dans le document.'
        : 'Great, the case is open. Send me the exhibits (PDF, DOCX or TXT) with the paperclip 📎, or use the text selected in the document.';
    case 'FACT_REVIEW':
      return fr
        ? `J’ai extrait ${c.facts.length} faits des pièces, en ordre chronologique. Cochez ceux à relier pour bâtir l’argument principal.`
        : `I extracted ${c.facts.length} facts from the exhibits, in chronological order. Tick the ones to tie together for the main argument.`;
    case 'ANALYSING':
      return fr
        ? `Merci. Je cherche la jurisprudence et la législation pertinentes sur CAIJ, puis je rédige l’argumentation à partir des ${c.session.selectedFactIds.length} faits retenus.`
        : `Thanks. I’m searching CAIJ for relevant case law and legislation, then drafting the argument from the ${c.session.selectedFactIds.length} selected facts.`;
    default:
      return null;
  }
}

export function App({ gateway, clock, extractors, saveDelayMs = 1000 }: AppProps) {
  const { caseFile, dispatch, say, update } = useCaseFile(gateway, clock, saveDelayMs);
  const [suggestion, setSuggestion] = useState<StanceSuggestion | null>(null);
  const [busy, setBusy] = useState('');
  const threadRef = useRef<HTMLElement>(null);
  const messageCount = caseFile?.messages.length ?? 0;
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, busy, caseFile?.session.step]);
  const step = caseFile?.session.step;
  const lang: Lang = caseFile?.session.lang ?? storedLang() ?? 'fr';
  const T = (k: string, v?: Record<string, string | number>) => t(lang, k, v);
  const question = caseFile && step === 'INTAKE' ? nextQuestion(caseFile, T) : null;

  // The language is asked once; later sessions reuse the remembered choice.
  useEffect(() => {
    const remembered = storedLang();
    if (caseFile && step === 'GREETING' && remembered) dispatch({ type: 'LANGUAGE_SET', lang: remembered });
  }, [caseFile, step, dispatch]);

  // Each new question or step is posted once as a bot message.
  const prompt = question?.text ?? (caseFile ? stepIntro(caseFile, lang) : null);
  useEffect(() => {
    if (!caseFile || !prompt) return;
    const lastBot = [...caseFile.messages].reverse().find((m) => m.role === 'bot');
    if (lastBot?.text !== prompt) say('bot', prompt);
  }, [prompt, caseFile, say]);

  // A stance suggestion is offered (never applied) once the lawyer has written something.
  const userMessages = caseFile?.messages.filter((m) => m.role === 'user').length ?? 0;
  useEffect(() => {
    if (step !== 'INTAKE' || !caseFile || caseFile.stance || userMessages === 0) return;
    let alive = true;
    void gateway
      .suggestStance(caseFile)
      .then((s) => {
        if (alive) setSuggestion(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gateway, userMessages > 0]);

  if (!caseFile) return <div className="av-app" aria-busy="true" />;
  const session = caseFile.session;

  const setLanguage = (l: Lang) => {
    storeLang(l);
    dispatch({ type: 'LANGUAGE_SET', lang: l });
  };

  const answer = (raw: string, chip?: Chip) => {
    if (!question) return;
    const result = applyAnswer(caseFile, question, raw, chip?.label);
    say('user', result.echo || '—');
    if (result.error || !result.caseFile) {
      say('bot', result.error ?? '');
      return;
    }
    // Keep messages added since the answer was computed (the user bubble).
    const answered = result.caseFile;
    const merge = (c: CaseFile): CaseFile => ({ ...answered, messages: c.messages });
    if (result.confirmStance) {
      const d = answered.intakeDraft ?? {};
      const stance: Stance = {
        role: d.role as Stance['role'],
        ...(d.role === 'other' ? { roleDescription: d.roleDescription ?? '' } : {}),
        clientName: d.clientName ?? '',
        opposingParties: (d.opposing ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        confirmedByUser: true,
        confirmedAt: clock.now().toISOString(),
        ...(suggestion && suggestion.clientName === d.clientName ? { suggestedFrom: suggestion.evidence } : {}),
      };
      dispatch({ type: 'STANCE_CONFIRMED', stance }, merge);
      return;
    }
    if (result.complete) {
      dispatch({ type: 'INTAKE_COMPLETE' }, merge);
      return;
    }
    update(merge);
  };

  const onSend = (text: string) => {
    if (session.step === 'GREETING') {
      say('user', text);
      const detected = detectLanguage(text);
      if (detected) setLanguage(detected);
      else say('bot', t(lang, 'askLanguage'));
      return;
    }
    if (question) {
      answer(text);
      return;
    }
    say('user', text);
    say(
      'bot',
      lang === 'fr'
        ? 'Utilisez les options ci-dessus pour continuer. La conversation libre arrive après la rédaction.'
        : 'Use the options above to continue. Free chat becomes available after drafting.',
    );
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    say('user', `${suggestion.clientName} — ${t(lang, `stance.${suggestion.role}`)}`);
    update((c) => ({ ...c, intakeDraft: { role: suggestion.role, clientName: suggestion.clientName } }));
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="av-app" lang={lang}>
        <header className="av-header">
          <span className="av-logo">
            <img src={logo} alt="" width={30} height={30} />
            Advocato
          </span>
          <LanguageToggle lang={session.lang} onChange={setLanguage} />
        </header>
        {session.step !== 'GREETING' && <StepIndicator step={session.step} round={session.round} />}
        <main ref={threadRef} className="av-thread" role="log" aria-live="polite" aria-label={t(lang, 'chat.label')}>
          <ul>
            <li className="av-msg" data-message data-role="bot">
              <img className="av-avatar" src={logo} alt="" />
              <div className="av-bubble">
                <p>{t(lang, 'greeting')}</p>
                {session.step === 'GREETING' && (
                  <p>Dans quelle langue souhaitez-vous travailler? / Which language would you like to work in?</p>
                )}
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
            <div className="av-chips" role="group" aria-label={t(lang, 'language.label')}>
              <button type="button" onClick={() => setLanguage('fr')}>
                Français
              </button>
              <button type="button" onClick={() => setLanguage('en')}>
                English
              </button>
            </div>
          )}

          {question && question.chips.length + (question.key === 'role' && suggestion ? 1 : 0) > 0 && (
            <div className="av-chips" role="group" aria-label={question.text}>
              {question.key === 'role' && suggestion && (
                <button
                  type="button"
                  className="av-chip-suggest"
                  onClick={useSuggestion}
                  title={suggestion.evidence.map((e) => `${e.exhibitId} ${e.locator}: ${e.excerpt}`).join('\n')}
                >
                  💡 {suggestion.clientName} — {t(lang, `stance.${suggestion.role}`)}
                </button>
              )}
              {question.chips.map((c) => (
                <button key={c.value || c.label} type="button" onClick={() => answer(c.value, c)}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {session.step === 'UPLOAD' && (
            <div className="av-card">
              <UploadStep caseFile={caseFile} gateway={gateway} extractors={extractors} onBusy={setBusy} onCaseFile={(c) => update(() => c)} />
            </div>
          )}
          {session.step === 'FACT_REVIEW' && (
            <div className="av-card">
              <FactReviewStep
                key={session.round}
                caseFile={caseFile}
                onSelect={(factIds) => {
                  say('user', lang === 'fr' ? `${factIds.length} faits retenus : ${factIds.join(', ')}` : `${factIds.length} facts selected: ${factIds.join(', ')}`);
                  dispatch({ type: 'FACTS_SELECTED', factIds });
                }}
              />
            </div>
          )}
          {session.step === 'ANALYSING' && (
            <div className="av-card av-card-doc">
              <AnalysisStep caseFile={caseFile} gateway={gateway} onCaseFile={(c) => update(() => c)} />
            </div>
          )}
          {busy && <Spinner label={busy} />}
        </main>
        <ChatInput onSend={onSend} placeholder={question?.freeText ? question.text : t(lang, 'chat.placeholder')} />
      </div>
    </LangContext.Provider>
  );
}
