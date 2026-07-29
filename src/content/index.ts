/**
 * content: Pinterest-scoped content script. Reads the live Ads Manager DOM on
 * request (a "snapshot" of visible interactive elements) and executes a single
 * click/type/select action on request. It never decides what to do — that
 * happens in `browser-agent` (side panel context), which asks the AI to pick
 * the next action from each snapshot. This mirrors how the original Pinterest
 * Auto Saver found its Save button: read the page, don't hardcode selectors.
 */

interface SnapshotElement {
  index: number;
  tag: string;
  type?: string;
  name: string;
  value?: string;
  disabled: boolean;
}

let lastElements: HTMLElement[] = [];

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
    return false;
  }
  return true;
}

function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim().slice(0, 100);
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return placeholder.trim().slice(0, 100);
  const title = el.getAttribute('title');
  if (title) return title.trim().slice(0, 100);
  return (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 100);
}

function takeSnapshot(): { elements: SnapshotElement[]; url: string; title: string } {
  const selector =
    'button, a[href], input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], [contenteditable="true"]';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter(isVisible)
    .slice(0, 150);
  lastElements = nodes;

  const elements: SnapshotElement[] = nodes.map((el, index) => ({
    index,
    tag: el.tagName.toLowerCase(),
    type: (el as HTMLInputElement).type || undefined,
    name: accessibleName(el),
    value: (el as HTMLInputElement).value || undefined,
    disabled: Boolean((el as HTMLInputElement).disabled),
  }));

  return { elements, url: location.href, title: document.title };
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function performAction(action: string, index: number, value?: string): { url: string; title: string } {
  const el = lastElements[index];
  if (!el) {
    throw new Error(`No element at index ${index} — the page changed, take a fresh snapshot.`);
  }
  el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });

  switch (action) {
    case 'click':
      el.click();
      break;
    case 'type':
      el.focus();
      setNativeValue(el as HTMLInputElement | HTMLTextAreaElement, value ?? '');
      break;
    case 'select': {
      const select = el as HTMLSelectElement;
      select.value = value ?? '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
    default:
      throw new Error(`Unknown action "${action}"`);
  }

  return { url: location.href, title: document.title };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PINADS_SNAPSHOT') {
    sendResponse(takeSnapshot());
    return true;
  }
  if (message?.type === 'PINADS_ACT') {
    try {
      const result = performAction(message.action, message.index, message.value);
      sendResponse({ ok: true, ...result });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }
  return false;
});
