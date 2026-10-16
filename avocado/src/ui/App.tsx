import { useEffect, useState } from 'react';
import { checkIntake, nextIntakeQuestions, type IntakeDraft } from '../core/intake/IntakeCompletenessChecker';
import { detectLanguage } from '../core/language/LanguageDetector';
import type { CaseFile, Lang, StanceSuggestion } from '../core/model';
import { ChatInput } from './components/ChatInput';
import { ChatThread } from './components/ChatThread';
import { IntakeForm } from './components/IntakeForm';
import { LanguageToggle } from './components/LanguageToggle';
import { MessageBubble } from './components/MessageBubble';
import { StepIndicator } from './components/StepIndicator';
import type { ServerGateway } from './gateway/ServerGateway';
import { FactReviewStep } from './containers/FactReviewStep';
import { UploadStep } from './containers/UploadStep';
import type { ExtractorRegistry } from './extraction/ExtractorRegistry';
import { useCaseFile, type Clock } from './hooks/useCaseFile';
import { LangContext, t } from './i18n';
import './theme.css';

export interface AppProps {
  gateway: ServerGateway;
  clock: Clock;
  extractors: ExtractorRegistry;
  saveDelayMs?: number;
}

export function App({ gateway, clock, extractors, saveDelayMs = 1000 }: AppProps) {
  const { caseFile, dispatch, say, update } = useCaseFile(gateway, clock, saveDelayMs);
  const [suggestion, setSuggestion] = useState<StanceSuggestion | null>(null);
  const step = caseFile?.session.step;

  useEffect(() => {
    if (step !== 'INTAKE' || !caseFile || caseFile.stance) return;
    let alive = true;
    void gateway.suggestStance(caseFile).then((s) => {
      if (alive) setSuggestion(s);
    });
    return () => {
      alive = false;
    };
    // Re-suggest only when the conversation grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, caseFile?.messages.length, gateway]);

  if (!caseFile) return <div className="av-app" aria-busy="true" />;

  const lang: Lang = caseFile.session.lang ?? 'fr';
  const session = caseFile.session;

  const setLanguage = (l: Lang) => dispatch({ type: 'LANGUAGE_SET', lang: l });

  const onSend = (text: string) => {
    say('user', text);
    if (session.step === 'GREETING') {
      const detected = detectLanguage(text);
      if (detected) setLanguage(detected);
      else say('bot', t(lang, 'askLanguage'));
    }
  };

  const onIntakeSubmit = (form: Omit<IntakeDraft, 'stance' | 'documentCount'>) => {
    const draft: IntakeDraft = { ...form, stance: caseFile.stance };
    const check = checkIntake(draft, { stage: 'intake' });
    if (!check.complete) {
      const questions = nextIntakeQuestions(check.missing).map((k) => `- ${t(lang, k)}`);
      say('bot', [t(lang, 'intake.missingIntro'), ...questions].join('\n'));
      dispatch({ type: 'INFO_MISSING', fields: check.missing });
      return;
    }
    dispatch({ type: 'INTAKE_COMPLETE' }, (c: CaseFile) => ({
      ...c,
      court: form.court ?? '',
      areaOfLaw: form.areaOfLaw ?? '',
      objective: form.objective,
      dateOfFacts: form.dateOfFacts ?? '',
      parties: form.parties ?? [],
      opposingArguments: form.opposingArguments ?? [],
      ...(form.procedureStage ? { procedureStage: form.procedureStage } : {}),
    }));
    say('bot', t(lang, 'intake.complete'));
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="av-app" lang={lang}>
        <header className="av-header">
          <span className="av-logo">🥑 {t(lang, 'appName')}</span>
          <LanguageToggle lang={session.lang} onChange={setLanguage} />
        </header>
        <StepIndicator step={session.step} round={session.round} />
        <main style={{ display: 'contents' }}>
          <ChatThread
            messages={caseFile.messages}
            lead={
              <>
                <MessageBubble role="bot" text={t(lang, 'greeting')} />
                {session.step === 'GREETING' && <MessageBubble role="bot" text={t(lang, 'greetingPrompt')} />}
              </>
            }
          />
          {session.step === 'INTAKE' && (
            <IntakeForm
              confirmedStance={caseFile.stance}
              suggestion={suggestion}
              now={() => clock.now()}
              onConfirmStance={(stance) => dispatch({ type: 'STANCE_CONFIRMED', stance })}
              onSubmit={onIntakeSubmit}
            />
          )}
          {session.step === 'UPLOAD' && (
            <UploadStep caseFile={caseFile} gateway={gateway} extractors={extractors} onCaseFile={(c) => update(() => c)} />
          )}
          {session.step === 'FACT_REVIEW' && (
            <FactReviewStep
              key={session.round}
              caseFile={caseFile}
              onSelect={(factIds) => dispatch({ type: 'FACTS_SELECTED', factIds })}
            />
          )}
          <ChatInput onSend={onSend} />
        </main>
      </div>
    </LangContext.Provider>
  );
}
