import type { SyncResult } from '@7even/contracts';
export interface QueuedAction {
  eventId: string;
  schemaVersion: 1;
  reservationId: string;
  expectedRevision: number;
  action: 'CHECK_IN' | 'FULFILL' | 'CANCEL';
  occurredAt: string;
  reason?: string;
}
export interface StoredAction {
  event: QueuedAction;
  state: 'PENDING' | 'CONFLICT' | 'REJECTED';
  message?: string;
}
const DATABASE = 'seven-reception-v1';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('queues');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error('This browser cannot store offline actions. Keep the reception desk online.'),
      );
  });
}
export async function readQueue(scope: string): Promise<StoredAction[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('queues', 'readonly').objectStore('queues').get(scope);
      request.onsuccess = () => resolve((request.result as StoredAction[] | undefined) ?? []);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function mutateQueue(
  scope: string,
  change: (current: StoredAction[]) => StoredAction[],
): Promise<StoredAction[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('queues', 'readwrite');
      const store = transaction.objectStore('queues');
      const request = store.get(scope);
      let next: StoredAction[] = [];
      request.onsuccess = () => {
        try {
          next = change((request.result as StoredAction[] | undefined) ?? []);
          store.put(next, scope);
        } catch (cause) {
          transaction.abort();
          reject(cause);
        }
      };
      transaction.oncomplete = () => resolve(next);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('The offline queue could not be saved.'));
    });
  } finally {
    db.close();
  }
}
export function appendQueue(scope: string, item: StoredAction): Promise<StoredAction[]> {
  return mutateQueue(scope, (current) => {
    if (current.some((existing) => existing.event.reservationId === item.event.reservationId))
      throw new Error('An action for this reservation is already queued. Resolve it first.');
    if (current.length >= 50)
      throw new Error('Send or resolve the current queue before adding more actions.');
    return [...current, item];
  });
}
export async function clearQueues(): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('queues', 'readwrite');
      transaction.objectStore('queues').clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export async function restrictQueueOwner(ownerPrefix: string | null): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('queues', 'readwrite');
      const request = transaction.objectStore('queues').openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (!ownerPrefix || !String(cursor.key).startsWith(ownerPrefix)) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export function applySyncResults(items: StoredAction[], result: SyncResult): StoredAction[] {
  const outcomes = new Map(result.outcomes.map((outcome) => [outcome.eventId, outcome]));
  return items.flatMap((item) => {
    const outcome = outcomes.get(item.event.eventId);
    if (!outcome) return [item];
    if (outcome.status === 'APPLIED' || outcome.status === 'DUPLICATE') return [];
    return [{ ...item, state: outcome.status, message: outcome.message }];
  });
}
