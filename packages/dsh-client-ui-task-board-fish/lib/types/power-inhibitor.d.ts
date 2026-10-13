import { type ChildProcess, type SpawnSyncReturns } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { TaskBoardPowerSnapshot } from './protocol.ts';
declare const WINDOWS_HELPER: string;
declare const LINUX_HELPER: string;
declare const LINUX_INHIBIT_PATHS: readonly ["/usr/bin/systemd-inhibit", "/bin/systemd-inhibit"];
export interface PowerReasons {
    runningSessions: number;
    armedSchedules: number;
    sessionStateKnown: boolean;
}
export interface SpawnOptions {
    shell: false;
    windowsHide: boolean;
    stdio: ['pipe', 'pipe', 'pipe'] | ['ignore', 'ignore', 'ignore'];
}
export type SpawnLike = (file: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
export type SpawnSyncLike = (file: string, args: readonly string[], options: {
    stdio: 'ignore';
    timeout: number;
    windowsHide: boolean;
}) => Pick<SpawnSyncReturns<Buffer>, 'status' | 'error'>;
export interface PowerInhibitorOptions {
    platform?: NodeJS.Platform;
    pid?: number;
    env?: NodeJS.ProcessEnv;
    spawn?: SpawnLike;
    spawnSync?: SpawnSyncLike;
    exists?: typeof existsSync;
    execPath?: string;
    setTimeout?: typeof globalThis.setTimeout;
    clearTimeout?: typeof globalThis.clearTimeout;
}
export declare class PowerInhibitor {
    private readonly listeners;
    private enabled;
    private reasons;
    private phase;
    private child;
    private retry;
    private retryReset;
    private retryIndex;
    private lastError;
    private stopping;
    private readonly platform;
    private readonly pid;
    private readonly env;
    private readonly spawn;
    private readonly spawnSync;
    private readonly exists;
    private readonly execPath;
    private readonly timer;
    private readonly clearTimer;
    private linuxProbe;
    constructor(options?: PowerInhibitorOptions);
    setEnabled(enabled: boolean): void;
    updateReasons(reasons: PowerReasons): void;
    subscribe(listener: () => void): () => void;
    snapshot(): TaskBoardPowerSnapshot;
    dispose(): void;
    private desired;
    private sync;
    private acquire;
    private markReady;
    private fail;
    private release;
    private clearRetryReset;
    private windowsPowerShell;
    private linuxSystemdInhibit;
    private spawnCommand;
    private emit;
}
export { LINUX_HELPER, LINUX_INHIBIT_PATHS, WINDOWS_HELPER };
