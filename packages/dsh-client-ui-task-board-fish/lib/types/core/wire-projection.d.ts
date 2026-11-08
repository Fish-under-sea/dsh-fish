/**
 * What an extension's `integrations` container looks like once it leaves the
 * Host.
 *
 * The container is provider-owned and crosses the board unread, and it also
 * crosses the wire: the HTTP snapshot, every action answer, and the remote
 * bridge's `board.snapshot` all carry it. A credential a provider stored there
 * would therefore reach every browser and phone paired to this Host. This
 * module is the one place that decides otherwise: the ledger keeps the payload
 * verbatim (the provider reads it back through its in-process capability face,
 * and a Host-side consumer reads the ledger itself), while the copy that leaves
 * carries no credential.
 *
 * @module dsh-task-board/core/wire-projection
 */
import type { TaskBoardSnapshot } from '../protocol.ts';
import type { TaskRecord } from './tasks.ts';
/**
 * The card as the wire may show it: the ledger record with its integration
 * entries copied and stripped.
 *
 * A card that carries no integrations is returned untouched, so a provider that
 * stores nothing sees exactly the record the board has always published.
 * @param task - the ledger record about to be serialized.
 * @returns the projected record; the ledger object is never mutated.
 */
export declare function projectTaskForWire(task: TaskRecord): TaskRecord;
/**
 * The snapshot as every read path serializes it: the HTTP `state` answer, the
 * HTTP `action` answer, and the remote bridge's `board.snapshot` all start from
 * the object this returns.
 * @param snapshot - the snapshot the Host service built from its live state.
 * @returns the same snapshot with each card projected through {@link projectTaskForWire}.
 */
export declare function projectSnapshotForWire(snapshot: TaskBoardSnapshot): TaskBoardSnapshot;
