/**
 * Owns the Pinterest tab lifecycle and message-passing to the content script.
 * Lives in the side panel context, which has the `tabs` permission.
 */

const ADS_MANAGER_URL = 'https://ads.pinterest.com/';

export interface SnapshotElement {
  index: number;
  tag: string;
  type?: string;
  name: string;
  value?: string;
  disabled: boolean;
}

export interface SnapshotResponse {
  elements: SnapshotElement[];
  url: string;
  title: string;
}

export interface ActResponse {
  ok: boolean;
  url?: string;
  title?: string;
  error?: string;
}

function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') done();
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(done, timeoutMs);
  });
}

/** Finds an existing Pinterest Ads Manager tab or opens a fresh one. */
export async function ensurePinterestAdsTab(): Promise<number> {
  const existing = await chrome.tabs.query({ url: 'https://ads.pinterest.com/*' });
  if (existing[0]?.id) {
    await chrome.tabs.update(existing[0].id, { active: true });
    return existing[0].id;
  }
  const tab = await chrome.tabs.create({ url: ADS_MANAGER_URL, active: true });
  if (!tab.id) throw new Error('Failed to open a Pinterest Ads Manager tab.');
  await waitForTabComplete(tab.id);
  return tab.id;
}

async function sendWithRetry<T>(tabId: number, message: unknown, retries = 5): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chrome.tabs.sendMessage<unknown, T>(tabId, message);
    } catch (error) {
      if (attempt === retries) throw error;
      // Content script may not be injected yet right after navigation — wait and retry.
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Unreachable');
}

export function snapshotTab(tabId: number): Promise<SnapshotResponse> {
  return sendWithRetry<SnapshotResponse>(tabId, { type: 'PINADS_SNAPSHOT' });
}

export function actOnTab(
  tabId: number,
  action: string,
  index: number,
  value?: string
): Promise<ActResponse> {
  return sendWithRetry<ActResponse>(tabId, { type: 'PINADS_ACT', action, index, value });
}
