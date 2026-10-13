import { type TaskRecord } from './tasks.ts';
/** Persistence seam for the task ledger. */
export interface TaskStore {
    /** Read the persisted ledger (empty when nothing is stored yet). */
    load(): TaskRecord[];
    /** Persist the whole ledger (replaces the stored document). */
    save(tasks: readonly TaskRecord[]): void;
    /** Drop the persisted ledger (leaves the in-memory state alone). */
    clear(): void;
    /**
     * Subscribe to ledger changes written by ANOTHER tab of the same origin
     * (browser storage events). The board controller reloads the ledger on
     * such a change, so a task deleted in one tab cannot keep firing (or be
     * written back) from the stale in-memory copy of another tab. No-op when
     * the backend has no cross-instance channel (in-memory store).
     */
    subscribeExternal?(listener: () => void): () => void;
}
/** Storage key for the task ledger document. */
export declare const DEFAULT_STORAGE_KEY = "dsh.taskBoard.v1";
/** Structural shape of the storage event fired in sibling tabs (DOM-free). */
export interface StorageChangeEvent {
    key: string | null;
}
/** The event-target face the store needs for cross-tab notifications. */
export interface StorageEvents {
    addEventListener(type: 'storage', listener: (event: StorageChangeEvent) => void): void;
    removeEventListener(type: 'storage', listener: (event: StorageChangeEvent) => void): void;
}
/** A task record is structurally valid if it round-trips through the UI. */
export declare function isTaskRecord(value: unknown): value is TaskRecord;
/** Parse + validate a persisted ledger document; invalid rows are dropped. */
export declare function parseLedger(raw: string | null): TaskRecord[];
/** localStorage-backed store (the browser backend). */
export declare class LocalStorageTaskStore implements TaskStore {
    private readonly key;
    private readonly storage;
    private readonly events;
    /**
     * @param key - storage key for the ledger document.
     * @param storage - storage backend (defaults to the global localStorage; tests inject fakes).
     * @param events - storage-event target for cross-tab notifications (defaults
     *   to the browser global; undefined in non-browser runtimes, where the
     *   subscription becomes a no-op).
     */
    constructor(key?: string, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined, events?: StorageEvents | undefined);
    load(): TaskRecord[];
    save(tasks: readonly TaskRecord[]): void;
    clear(): void;
    /**
     * Cross-tab change subscription (see {@link TaskStore.subscribeExternal}).
     * The browser fires the storage event in every OTHER tab of the same origin
     * when one tab writes; a null key means the whole storage was cleared. Both
     * cases reload the ledger here; unrelated keys are ignored.
     */
    subscribeExternal(listener: () => void): () => void;
}
/** In-memory backend (tests, and a fallback when storage is unavailable). */
export declare class InMemoryTaskStore implements TaskStore {
    private ledger;
    load(): TaskRecord[];
    save(tasks: readonly TaskRecord[]): void;
    clear(): void;
}
