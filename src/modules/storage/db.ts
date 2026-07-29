/**
 * IndexedDB connection. Only this module touches the database directly;
 * everything else goes through the typed repositories in `repository.ts`.
 */

const DB_NAME = 'pinads-studio-ai';
const DB_VERSION = 1;

export const STORE_CAMPAIGNS = 'campaigns';
export const STORE_CONVERSATIONS = 'conversations';
export const STORE_SETTINGS = 'settings';
export const STORE_WEBSITE_ANALYSES = 'websiteAnalyses';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CAMPAIGNS)) {
        db.createObjectStore(STORE_CAMPAIGNS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_WEBSITE_ANALYSES)) {
        db.createObjectStore(STORE_WEBSITE_ANALYSES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}
