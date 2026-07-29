/** chrome.identity is only present inside a real extension context (not a plain browser tab). */
export function getPinterestRedirectUri(): string {
  if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
    return chrome.identity.getRedirectURL('pinterest');
  }
  return '(available once loaded as a Chrome extension)';
}
