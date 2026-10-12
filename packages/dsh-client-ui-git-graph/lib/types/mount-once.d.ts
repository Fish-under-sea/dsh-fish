/**
 * Host single-instance guard shared by the plugin family. The family bundle
 * (dsh-web-all / dsh-skins) namespaces every child row id (web-ui-*), so
 * the loader accepts a standalone install of the same package side by side;
 * without this guard the second instance would still re-register the same
 * webserver routes, tools, settings namespaces, and system-prompt sections
 * and fail the boot. mountOnce makes a mount of an already-mounted package a
 * no-op for as long as the first instance lives (the browser half is already
 * deduped by package name in the client module host).
 *
 * A no-op is only safe while the holder is ALIVE. The holder can be disposed
 * long after the refused mount ran its course: the Host reloads a profile by
 * creating the new loader entries before the old ones are torn down (a
 * plugin-manager enable/disable/install write, a settings-driven row reload,
 * HMR), so the new aggregate shell entry mounts its family plugin while the
 * previous entry still owns the name. Dropping that refused mount lost the
 * plugin for good - the previous entry then disposed its own mount, releasing
 * the name with nobody left to take it, and the family row stayed listed as
 * active while its host routes 404ed (the task-board panel showed
 * "board.hostError.notMounted", no degraded record appeared, and only a Host
 * restart recovered it).
 *
 * The refused mount is therefore QUEUED, not dropped, and replayed the moment
 * the holder releases the name - if the waiting fiber is still alive then. The
 * single-instance guarantee is unchanged: exactly one mount is live per
 * package name, and the replay re-enters the guard so a later mount still
 * dedupes against it.
 *
 * The registry rides a global symbol so two module instances of the same
 * package (npm copy vs repository link) still share one verdict. That symbol
 * is a CROSS-REPOSITORY contract, not this file's private state: the four
 * satellite packages (dsh-skins / dsh-pet / dsh-presets /
 * dsh-community-plugins) are separate repositories carrying their own copy of
 * this guard, rebuilt on their own schedule, so the value under `MOUNTED`
 * must keep the shape every published copy reads (a `Set` of package names
 * with `has`/`add`/`delete`). The wait queues this guard added therefore live
 * under their own additive key, and the registry reads back a `Set` even when
 * some other build left a different value there. Changing `MOUNTED`'s shape
 * in place broke that contract once: a satellite's legacy copy created a
 * `Set`, the family's new copy read it as a `Map`, and every family row
 * mounted after it failed with "claims.get is not a function".
 *
 * cordis `ctx.effect` runs its callback immediately and treats the callback's
 * return value as the fiber disposer, so the unmarker is returned, not run.
 */
/**
 * Wrap a cordis plugin apply so the package runs at most once per process.
 * The first mount registers normally and releases the name when its fiber
 * disposes; a mount refused while that name is held waits for the release and
 * then runs, unless its own fiber disposes first.
 * @param packageName - npm package identity shared by every install source.
 * @param fn - the original plugin apply.
 * @returns an apply of the same shape.
 */
export declare function mountOnce<T extends (...args: any[]) => unknown>(packageName: string, fn: T): T;
//# sourceMappingURL=mount-once.d.ts.map