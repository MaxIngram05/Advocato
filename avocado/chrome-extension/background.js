// Clicking the toolbar icon opens Advocato in Chrome's side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
