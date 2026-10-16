import { composeServer } from './compose';
import { handleRpc } from './rpc';

/**
 * Apps Script entry points (§9.2). Every export becomes a global function in
 * dist/Code.js (see scripts/build-server.ts).
 */
export function onOpen(): void {
  DocumentApp.getUi().createAddonMenu().addItem('Open', 'showSidebar').addToUi();
}

export function onInstall(): void {
  onOpen();
}

export function showSidebar(): void {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Avocado');
  DocumentApp.getUi().showSidebar(html);
}

/** Single RPC endpoint for the sidebar: `google.script.run.avocadoRpc(method, argsJson)`. */
export function avocadoRpc(method: string, argsJson: string): Promise<string> {
  return handleRpc(composeServer(), method, argsJson);
}
