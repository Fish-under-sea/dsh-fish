/**
 * Cluster execution: run one command concurrently across selected hosts; the
 * caller must provide at least one non-empty aliases / environment / tags filter.
 */
import type { ClusterResult } from '../protocol.ts';
import { type PoolEngine } from './connection-pool.ts';
interface ClusterOptions {
    command: string;
    aliases?: string[];
    environment?: string;
    tags?: string[];
    timeoutMs?: number;
    maxWorkers?: number;
    /** Caller cancellation, forwarded to every host's command. */
    signal?: AbortSignal;
}
/** Run one command against many hosts concurrently. */
export declare function cluster(engine: PoolEngine, options: ClusterOptions): Promise<ClusterResult[]>;
export {};
