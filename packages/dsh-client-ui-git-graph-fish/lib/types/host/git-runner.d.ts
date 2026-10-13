/**
 * Shared host git subprocess plumbing: the run result shape, the runner seam,
 * the collected-output cap, and the production runner over the subprocess
 * service. Packages receive this file as a generated copy via
 * scripts/sync-shared.mjs; edit the shared source and re-run the sync instead
 * of editing a copy.
 *
 * The context shape is declared structurally so this module stays
 * self-contained (shared/ has no cordis dependency): any context whose
 * `subprocess` satisfies SubprocessServiceLike works, which the plugin
 * contexts do.
 * @module dsh-web-shared/host/git-runner
 */
/** One finished git invocation. */
export interface GitRunResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
}
/** The spawn seam the service runs git through (subprocess service in production). */
export interface GitRunner {
    run(argv: readonly string[], cwd: string, signal?: AbortSignal): Promise<GitRunResult>;
}
/** Collected-output cap for one git command. */
export declare const OUTPUT_CAP_BYTES: number;
/** The subprocess service surface this runner consumes (structural). */
export interface SubprocessServiceLike {
    spawn(spec: {
        argv: readonly string[];
        cwd: string;
        stdio: {
            stdin: 'ignore';
            stdout: {
                maxBytes: number;
            };
            stderr: {
                maxBytes: number;
            };
        };
        graceMs: number;
        signal?: AbortSignal;
    }): {
        done: Promise<{
            exitCode: number | null;
        }>;
        collected: {
            stdout?: {
                readFrom(offset: number): {
                    text: string;
                };
            };
            stderr?: {
                readFrom(offset: number): {
                    text: string;
                };
            };
        };
    };
}
/** Per-package knobs for the shared production runner. */
export interface GitRunnerOptions {
    /** Build the full spawn argv from the git args (default ['git', ...argv]). */
    spawnArgv?: (argv: readonly string[]) => readonly string[];
    /** degrade turns spawn/run failures into exitCode 127 results instead of throwing. */
    failureMode?: 'throw' | 'degrade';
    /** console.error tag for degrade mode. */
    errorTag?: string;
}
/**
 * Production runner over the subprocess service: one managed child per
 * command, bounded collect on both streams. A caller-owned AbortSignal reaches
 * the subprocess tree and remains authoritative even in degrade mode. Degrade
 * mode keeps the SCM tab showing the friendly "not a git repository" state
 * instead of a bare 400 when git is missing or the subprocess service fails.
 * @param ctx - context carrying the subprocess service.
 * @param options - per-package behavior knobs.
 * @returns the runner.
 */
export declare function subprocessRunner(ctx: {
    subprocess: SubprocessServiceLike;
}, options?: GitRunnerOptions): GitRunner;
//# sourceMappingURL=git-runner.d.ts.map