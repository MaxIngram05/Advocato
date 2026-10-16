# Decisions log

Every choice made beyond the build prompt is listed here with the prompt section it relates to.

| # | Section | Decision | Reason |
|---|---|---|---|
| D1 | §9.2 | Per-call `UrlFetchApp` timeout is **not documented** on Google's quota page (checked 2026-10-16, https://developers.google.com/apps-script/guides/services/quotas). Documented limits: 6 min per script execution, 50 MB response, 50 MB POST, 20 000 (consumer) / 100 000 (Workspace) fetches per day. We keep one LLM task per RPC so the 6-min bound holds against Augure's ~240 s non-streaming timeout. | No relay backend is added unless live calls show timeouts (then we ask). |
| D2 | §9.2 / §0 | Toolchain pins: React 18.3.1 (spec), TypeScript 5.9.2, Vite 6.3.5, Vitest 3.2.4, zod 3.25.76 (works with `zod-to-json-schema`), ESLint 9 + typescript-eslint 8 strict, Playwright 1.55. | Stable versions known to work together; spec asks for React 18 and zod-to-json-schema. |
| D3 | §9.2 | Server bundle: esbuild IIFE with global `__avocado`; `scripts/build-server.ts` appends a top-level `function <name>()` stub per export. | Apps Script only treats declared functions as triggers/menu targets/`google.script.run` endpoints. |
| D4 | §9.2 | `appsscript.json` sets `urlFetchWhitelist` for Augure, CAIJ and LégisQuébec. | Required for a published Editor add-on; harmless in dev. |
| D5 | §17 | Architecture boundaries are enforced with `eslint-plugin-boundaries` (`eslint.config.js`). | Spec allows this tool or dependency-cruiser. |
| D6 | repo | The app lives in `avocado/` inside the existing `Advocato` repo; root `.gitignore` conflict markers (left by a merge) were resolved by keeping both entries. | Existing repo already holds unrelated files. |
| D7 | §6 US-02 vs §7 | `documents` is a required intake field, but §7 places UPLOAD after INTAKE_COMPLETE. `checkIntake(draft, { stage: 'intake' })` ignores `documents` to leave INTAKE; the full check (documents included) gates analysis (G9). | Keeps both the state machine and US-02. |
| D8 | §6 US-02 / G10 | Documents arrive after intake, so a stance suggestion at intake can only come from the intake chat text (`suggestStance`). After upload, a document-based suggestion may be shown; changing the stance then follows the §7 stance-change invariant. A suggestion is never applied without a click. | Documents are not available yet during intake. |
