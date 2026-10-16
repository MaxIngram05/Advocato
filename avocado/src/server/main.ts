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
