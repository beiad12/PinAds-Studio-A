import { openDatabase } from './db';

/** Generic typed repository over a single IndexedDB object store. */
export class Repository<T extends { id: string }> {
  constructor(private readonly storeName: string) {}

  private async withStore<R>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<R>
  ): Promise<R> {
    const db = await openDatabase();
    return new Promise<R>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getAll(): Promise<T[]> {
    return this.withStore('readonly', (store) => store.getAll());
  }

  get(id: string): Promise<T | undefined> {
    return this.withStore('readonly', (store) => store.get(id));
  }

  async put(item: T): Promise<T> {
    await this.withStore('readwrite', (store) => store.put(item));
    return item;
  }

  async delete(id: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(id));
  }
}
