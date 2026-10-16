import { composeServer } from './compose';
import { handleRpc } from './rpc';

/**
 * Apps Script entry points (§9.2). Every export becomes a global function in
 * dist/Code.js (see scripts/build-server.ts).
 */
export function onOpen(): void {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Ouvrir / Open', 'showSidebar')
    .addItem('Clé Augure / Augure key', 'configureAugureKey')
    .addToUi();
}

export function onInstall(): void {
  onOpen();
}

export function showSidebar(): void {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Advocato');
  DocumentApp.getUi().showSidebar(html);
}

/** Stores the Augure API key in Script Properties (never in the code or the document). */
export function configureAugureKey(): void {
  const ui = DocumentApp.getUi();
  const res = ui.prompt('Advocato', 'Clé API Augure / Augure API key:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const key = res.getResponseText().trim();
  if (!key) return;
  PropertiesService.getScriptProperties().setProperty('AUGURE_API_KEY', key);
  ui.alert('Advocato', 'Clé enregistrée. / Key saved.', ui.ButtonSet.OK);
}

/** Single RPC endpoint for the sidebar: `google.script.run.avocadoRpc(method, argsJson)`. */
export function avocadoRpc(method: string, argsJson: string): Promise<string> {
  return handleRpc(composeServer(), method, argsJson);
}
