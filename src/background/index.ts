/**
 * background: MV3 service worker entry point (composition root).
 * Opens the side panel on the toolbar icon click; storage/AI calls run in the
 * side panel document itself in this build (see docs/ARCHITECTURE.md §9 for
 * the future message-routing responsibility once content scripts land).
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set side panel behavior', error));
