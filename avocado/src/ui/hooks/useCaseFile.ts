import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaseFile, ChatMessage } from '../../core/model';
import { sessionReducer, type SessionEvent } from '../../core/session/sessionMachine';
import type { ServerGateway } from '../gateway/ServerGateway';

export interface Clock {
  now(): Date;
}

/** Applies a session event to a case file, keeping the case-level mirrors in sync. */
export function applyEvent(caseFile: CaseFile, event: SessionEvent): CaseFile {
  const session = sessionReducer(caseFile.session, event);
  return {
    ...caseFile,
    session,
    lang: session.lang ?? caseFile.lang,
    stance: session.stance,
  };
}

/**
 * Container state: the CaseFile, driven by the core session machine (§13 State).
 * Saves after every change, debounced (§12).
 */
export function useCaseFile(gateway: ServerGateway, clock: Clock, saveDelayMs = 1000) {
  const [caseFile, setCaseFile] = useState<CaseFile | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    void gateway.loadCase().then((c) => {
      if (alive) setCaseFile(c);
    });
    return () => {
      alive = false;
    };
  }, [gateway]);

  useEffect(() => {
    if (!caseFile || !dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      void gateway.saveCase(caseFile);
    }, saveDelayMs);
    return () => clearTimeout(timer);
  }, [caseFile, gateway, saveDelayMs]);

  const update = useCallback((change: (c: CaseFile) => CaseFile) => {
    setCaseFile((c) => {
      if (!c) return c;
      dirty.current = true;
      return change(c);
    });
  }, []);

  const dispatch = useCallback(
    (event: SessionEvent, patch: (c: CaseFile) => CaseFile = (c) => c) =>
      update((c) => applyEvent(patch(c), event)),
    [update],
  );

  const say = useCallback(
    (role: ChatMessage['role'], text: string) =>
      update((c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: `M-${c.messages.length + 1}`, role, text, at: clock.now().toISOString() },
        ],
      })),
    [update, clock],
  );

  return { caseFile, dispatch, update, say };
}
