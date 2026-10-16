# Avocado (MVP)

Avocado is a sidebar add-on for Google Docs. It guides a Québec lawyer from case documents to a sourced written argument:
intake → exhibits → extracted facts → fact selection → CAIJ case law search → argumentation matrix,
remedy, unfavorable evidence, arguments with rebuttals, table of authorities and points to verify.

> **Projet — à valider par un juriste avant tout dépôt, envoi ou usage dans une procédure.**
> Draft output only. Citations come only from CAIJ results; anything not checked is marked ⚠ Non vérifié / Unverified.

## Run the demo locally (live Augure + CAIJ)

Prerequisites: Node.js 20+ and an Augure API key.

```bash
cd avocado
npm ci
# The key is read from ../.env (repo root) or avocado/.env.local:
#   AUGURE_API_KEY=...        (optional: AUGURE_MODEL, default ossington-4-1)
npm run dev
```

Open http://localhost:5173. Add `?fake` to the URL to run fully offline with fake adapters (no LLM answers).

Demo flow:
1. Reply to "Bonjour, hi" (FR or EN) or click FR/EN.
2. Fill in the intake form. **Pick the client's role and click "Confirm role"**: the app never assumes a side.
3. Add exhibits (PDF, DOCX, TXT). Sample exhibits are in `tests/fixtures/ikeo/`. Then click **Analyse the exhibits**
   (one Augure call per exhibit, about 30–90 s each).
4. Tick facts, then **Continue**. The app searches CAIJ, then drafts the full document (1–3 min).
5. Download the result as HTML or copy it.

## Other commands

| Command | What |
|---|---|
| `npm test` | Unit, contract and integration tests (Vitest) |
| `npm run test:e2e` | Playwright smoke test on the offline harness (`npx playwright install chromium` once) |
| `npm run build` | `dist/Sidebar.html`, `dist/Code.js`, `dist/appsscript.json` for Apps Script |
| `npm run capture:caij` | Re-record CAIJ SSE fixtures |
| `LIVE=1 npm run test:contract` | LLM contract test against the real Augure API |
| `npx tsx scripts/smoke-live.ts` | Live end-to-end run on the sample exhibits (writes `smoke-output.json`) |

## Inside Google Docs (not yet verified end to end)

```bash
npx clasp login
cp .clasp.json.example .clasp.json   # set scriptId of a container-bound Docs script
npm run push
```

Set `AUGURE_API_KEY` in **Project Settings → Script Properties**, reload the Doc, then go to **Extensions → Avocado → Open**.
Known gaps in the MVP: the result is shown in the sidebar, not yet written into the Doc. See `docs/DECISIONS.md` (D18)
for the one Apps Script behaviour that must be confirmed on the first push.

## Status vs. the build spec

Done: M0–M5 (scaffold, session machine, intake, upload/extraction, LLM layer with grounding and guardrails, facts) plus an
MVP of M6–M8 (CAIJ search, grounded single-step analysis). Not done: writing to the Doc with named ranges (M9),
multi-round loop and rollback (M10), stasis mode (M11), the full acceptance test suite and §11 pinpoint/temporal verification (M12).
Architecture and decisions: `docs/DECISIONS.md`.
