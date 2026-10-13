import z from "@deepseek-ai/schemastery";
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute$1, join as join$1 } from "node:path/posix";
//#region src/mount-once.ts
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
/** Published cross-repository contract: package names currently mounted. */
const MOUNTED = Symbol.for("dsh-web.mounted-plugins");
/** Additive key this guard owns: refused mounts waiting for the name. */
const WAITERS = Symbol.for("dsh-web.mounted-plugins.waiters");
/**
* The shared name registry, always a `Set` whatever another build stored here:
* a foreign value (an interim shape, a hand-written global) must not take every
* family plugin down with it.
* @returns the process-wide set of mounted package names.
*/
function mountedSet() {
	const registry = globalThis;
	const existing = registry[MOUNTED];
	if (existing instanceof Set) return existing;
	const created = /* @__PURE__ */ new Set();
	registry[MOUNTED] = created;
	return created;
}
/** Queue per package name for mounts refused while a holder was alive. */
function mountWaiters() {
	const registry = globalThis;
	return registry[WAITERS] ??= /* @__PURE__ */ new Map();
}
/**
* Wrap a cordis plugin apply so the package runs at most once per process.
* The first mount registers normally and releases the name when its fiber
* disposes; a mount refused while that name is held waits for the release and
* then runs, unless its own fiber disposes first.
* @param packageName - npm package identity shared by every install source.
* @param fn - the original plugin apply.
* @returns an apply of the same shape.
*/
function mountOnce(packageName, fn) {
	const mount = (...args) => {
		const mounted = mountedSet();
		const ctx = args[0];
		if (mounted.has(packageName)) {
			const waiters = mountWaiters();
			const queue = waiters.get(packageName) ?? [];
			let alive = true;
			const pending = { run: () => {
				if (alive) mount(...args);
			} };
			ctx?.effect?.(() => () => {
				alive = false;
				const index = queue.indexOf(pending);
				if (index >= 0) queue.splice(index, 1);
			});
			queue.push(pending);
			waiters.set(packageName, queue);
			return;
		}
		mounted.add(packageName);
		ctx?.effect?.(() => () => {
			mounted.delete(packageName);
			const waiters = mountWaiters();
			const queue = waiters.get(packageName);
			if (queue === void 0) return;
			waiters.delete(packageName);
			for (const waiter of queue.splice(0)) queueMicrotask(() => {
				waiter.run();
			});
		});
		return fn(...args);
	};
	return mount;
}
//#endregion
//#region src/core/auto-rules.ts
const DAY_MS = 864e5;
/**
* Sessions eligible for auto-archive: unarchived, reliable last activity,
* inactive longer than the threshold, and not protected. Blank sessions are
* eligible (archiving hides an empty session without destroying anything);
* the current and running sessions are protected upstream of this predicate.
*/
function autoArchiveCandidates(rows, options) {
	const threshold = options.days * DAY_MS;
	const candidates = [];
	for (const row of rows) {
		if (row.archived) continue;
		if (!row.lastActivityReliable || row.lastActivityAt === void 0) continue;
		if (options.protectedIds.has(row.id)) continue;
		if (options.now - row.lastActivityAt <= threshold) continue;
		candidates.push({
			id: row.id,
			lastActivityAt: row.lastActivityAt
		});
	}
	candidates.sort((a, b) => a.lastActivityAt - b.lastActivityAt);
	return candidates;
}
/**
* Sessions eligible for auto-delete BEFORE family-cascade planning: archived
* with a KNOWN archive time, older than the retention threshold, and archived
* strictly before this run started (a session archived by the same tick is
* never deleted in that tick). Unknown archive times are excluded here, so
* pre-plugin historical archives can only ever leave through a manual delete.
*/
function autoDeleteSeedCandidates(rows, options) {
	const threshold = options.retainDays * DAY_MS;
	const candidates = [];
	for (const row of rows) {
		if (!row.archived || row.archivedAt === void 0) continue;
		if (options.protectedIds.has(row.id)) continue;
		if (row.archivedAt >= options.runStartedAt) continue;
		if (options.now - row.archivedAt <= threshold) continue;
		candidates.push({
			id: row.id,
			archivedAt: row.archivedAt,
			...row.sizeBytes !== void 0 ? { sizeBytes: row.sizeBytes } : {}
		});
	}
	candidates.sort((a, b) => a.archivedAt - b.archivedAt);
	return candidates;
}
//#endregion
//#region src/core/cascade.ts
/** All descendants of one id via the `childIds` edges (excluding the id itself). */
function descendantsOf(rows, id) {
	const childIds = /* @__PURE__ */ new Map();
	for (const row of rows) childIds.set(row.id, row.childIds);
	const seen = /* @__PURE__ */ new Set();
	const queue = [...childIds.get(id) ?? []];
	while (queue.length > 0) {
		const current = queue.pop();
		if (seen.has(current)) continue;
		seen.add(current);
		for (const child of childIds.get(current) ?? []) if (!seen.has(child)) queue.push(child);
	}
	return [...seen];
}
/**
* Authoritative delete plan. Rules:
* - A direct id missing from the inventory is skipped as `not-found`.
* - A direct id that is itself protected is skipped with its own reason; its
*   family is left untouched.
* - A family (direct id plus all descendants) containing ANY protected member
*   is skipped whole with `family-protected` — never a half-deleted family.
* - Every id appears at most once in `skipped`; a directly selected protected
*   id keeps its own reason even when a relative's family also covers it.
* - Everything else in the union of safe families is deleted.
*/
function planDelete(rows, directIds, protectedReason) {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const targets = /* @__PURE__ */ new Set();
	const skipped = [];
	const skippedIds = /* @__PURE__ */ new Set();
	const directSet = new Set(directIds);
	const seenDirect = /* @__PURE__ */ new Set();
	/** Record one skip once: an id reachable through several families stays single. */
	const pushSkipped = (entry) => {
		if (skippedIds.has(entry.id)) return;
		skippedIds.add(entry.id);
		skipped.push(entry);
	};
	for (const id of directIds) {
		if (seenDirect.has(id)) continue;
		seenDirect.add(id);
		if (byId.get(id) === void 0) {
			pushSkipped({
				id,
				status: "skipped",
				reason: "not-found"
			});
			continue;
		}
		const ownReason = protectedReason.get(id);
		if (ownReason !== void 0) {
			pushSkipped({
				id,
				status: "skipped",
				reason: ownReason
			});
			continue;
		}
		const family = [id, ...descendantsOf(rows, id)];
		const blocker = family.find((member) => protectedReason.has(member));
		if (blocker !== void 0) {
			for (const member of family) {
				if (targets.has(member) || skippedIds.has(member)) continue;
				if (directSet.has(member) && protectedReason.has(member)) continue;
				pushSkipped({
					id: member,
					status: "skipped",
					reason: "family-protected",
					detail: `${blocker}:${protectedReason.get(blocker)}`
				});
			}
			continue;
		}
		for (const member of family) targets.add(member);
	}
	let totalBytes = 0;
	for (const id of targets) {
		const size = byId.get(id)?.sizeBytes;
		if (typeof size === "number") totalBytes += size;
	}
	return {
		direct: [...seenDirect],
		descendants: [...targets].filter((id) => !seenDirect.has(id)),
		skipped,
		targets: [...targets],
		totalBytes
	};
}
//#endregion
//#region src/core/config.ts
/**
* Read one activation field's current value. A volatile reference is read at
* call time, so the caller always sees the latest committed value.
*/
function readConfigField(field) {
	if (field === void 0) return void 0;
	const ref = field;
	return typeof ref.get === "function" ? ref.get() : field;
}
/**
* Read the effective settings of one activation. The 0.1.7 model keeps no
* separate settings document: the plugin's own Config is what the Host serves
* and what the row is activated with, so this is the only settings source.
* @param config - the config the Host passed to the activation.
* @returns the raw field values, defaults left to {@link resolveAutoConfig}.
*/
function readArchiveConfig(config) {
	return {
		enabled: readConfigField(config?.enabled),
		autoArchiveEnabled: readConfigField(config?.autoArchiveEnabled),
		autoArchiveDays: readConfigField(config?.autoArchiveDays),
		autoDeleteEnabled: readConfigField(config?.autoDeleteEnabled),
		autoDeleteDays: readConfigField(config?.autoDeleteDays),
		checkIntervalMin: readConfigField(config?.checkIntervalMin)
	};
}
const AUTO_ARCHIVE_DAYS_MAX = 3650;
const AUTO_DELETE_DAYS_MAX = 3650;
const CHECK_INTERVAL_MIN_MAX = 1440;
const DEFAULT_AUTO_CONFIG = {
	enabled: true,
	autoArchiveEnabled: false,
	autoArchiveDays: 7,
	autoDeleteEnabled: false,
	autoDeleteDays: 7,
	checkIntervalMin: 60
};
/** Validate one day-threshold field; returns the rounded value or undefined when invalid. */
function validateDays(value, min, max) {
	if (typeof value !== "number" || !Number.isFinite(value)) return void 0;
	const rounded = Math.round(value);
	if (rounded < min || rounded > max) return void 0;
	return rounded;
}
/**
* Coerce a raw config into resolved values. Invalid or out-of-range fields
* fall back to defaults — the settings UI validates before saving, and this
* guards profile-patch hand-written values.
*/
function resolveAutoConfig(config) {
	const days = validateDays(config?.autoArchiveDays, 1, AUTO_ARCHIVE_DAYS_MAX);
	const retain = validateDays(config?.autoDeleteDays, 1, AUTO_DELETE_DAYS_MAX);
	const interval = validateDays(config?.checkIntervalMin, 15, CHECK_INTERVAL_MIN_MAX);
	return {
		enabled: config?.enabled ?? DEFAULT_AUTO_CONFIG.enabled,
		autoArchiveEnabled: config?.autoArchiveEnabled ?? DEFAULT_AUTO_CONFIG.autoArchiveEnabled,
		autoArchiveDays: days ?? DEFAULT_AUTO_CONFIG.autoArchiveDays,
		autoDeleteEnabled: config?.autoDeleteEnabled ?? DEFAULT_AUTO_CONFIG.autoDeleteEnabled,
		autoDeleteDays: retain ?? DEFAULT_AUTO_CONFIG.autoDeleteDays,
		checkIntervalMin: interval ?? DEFAULT_AUTO_CONFIG.checkIntervalMin
	};
}
//#endregion
//#region src/host/session-files.ts
/**
* Session storage file layer: legacy jsonl.zstd directory discovery, segment
* matching, path-safety checks, size accounting, and session-rdb sqlite row
* deletion. The physical-delete boundary — every path removal here is
* validated to stay inside the sessions root and never follows symlinks out.
* @module @fish-under-sea/dsh-session-archive-fish/host/session-files
*/
/**
* Canonical session id for one segment dir name. DSH persistence keys the
* segment off the session id: a `session-<uuid>` id lands as segment
* `<uuid>` (and some layouts keep the prefix). One dir maps to exactly one
* canonical id — the `session-`-prefixed form used everywhere else — so the
* inventory never produces phantom duplicate rows.
*/
function canonicalSessionId(segment) {
	return segment.startsWith("session-") ? segment : `session-${segment}`;
}
function dirSize(path) {
	let total = 0;
	let entries;
	try {
		entries = readdirSync(path);
	} catch {
		return 0;
	}
	for (const entry of entries) try {
		const stat = statSync(join(path, entry));
		if (stat.isDirectory()) total += dirSize(join(path, entry));
		else total += stat.size;
	} catch {}
	return total;
}
/** True when `child` is `root` itself or lies under it (realpath-ed, lexical). */
function isInside(root, child) {
	return relativeWithin(root, child) !== void 0;
}
/** Lexical relative path of `child` under `root`, or undefined when outside. */
function relativeWithin(root, child) {
	const rootAbs = resolve(root);
	const childAbs = resolve(child);
	if (childAbs === rootAbs) return "";
	if (!childAbs.startsWith(rootAbs + sep)) return void 0;
	return childAbs.slice(rootAbs.length + 1);
}
/**
* Scan the sessions root once and index every session dir. A session dir is
* any directory under `<sessionsRoot>/<project>/` (the project key dirs are
* the cwd-encoded ones). Symlinks are never followed into the index: a link
* under the sessions root pointing outside is recorded as unreadable instead.
*/
function indexSessionDirs(sessionsRoot) {
	const index = {
		byId: /* @__PURE__ */ new Map(),
		sizes: /* @__PURE__ */ new Map(),
		unreadable: []
	};
	if (!existsSync(sessionsRoot)) return index;
	let rootReal;
	try {
		rootReal = realpathSync(sessionsRoot);
	} catch {
		return index;
	}
	let projectDirs;
	try {
		projectDirs = readdirSync(sessionsRoot);
	} catch {
		return index;
	}
	for (const project of projectDirs) {
		const projectPath = join(sessionsRoot, project);
		let entries;
		try {
			entries = readdirSync(projectPath);
		} catch {
			continue;
		}
		for (const segment of entries) {
			const dirPath = join(projectPath, segment);
			let stat;
			try {
				stat = statSync(dirPath);
			} catch {
				continue;
			}
			if (!stat.isDirectory()) continue;
			let real;
			try {
				real = realpathSync(dirPath);
			} catch {
				index.unreadable.push(dirPath);
				continue;
			}
			if (!isInside(rootReal, real)) {
				index.unreadable.push(dirPath);
				continue;
			}
			for (const candidate of [canonicalSessionId(segment)]) if (!index.byId.has(candidate)) {
				index.byId.set(candidate, dirPath);
				index.sizes.set(candidate, dirSize(dirPath));
			}
		}
	}
	return index;
}
/** The session-rdb sqlite locations DSH/dsh-perf use, most likely first. */
function rdbDbPaths(dshHome) {
	return [join(dshHome, "sessions", "sessions.sqlite"), join(dshHome, "sessions.sqlite")];
}
/** The session-rdb fingerprint: application_id + user_version (dsh-perf contract). */
function isSessionRdb(dbPath) {
	if (!existsSync(dbPath)) return false;
	try {
		const db = new DatabaseSync(dbPath, { readOnly: true });
		try {
			const appId = db.prepare("pragma application_id").get();
			const userVersion = db.prepare("pragma user_version").get();
			return appId?.application_id === 1146308688 && userVersion?.user_version === 1;
		} finally {
			db.close();
		}
	} catch {
		return false;
	}
}
/**
* Delete one session's rows from a session-rdb store. FK cascades remove the
* event tables; returns true when a row was deleted, false when the session
* was absent. Throws on storage errors (the caller converts to a failure).
*/
function deleteRdbSession(dbPath, id) {
	const db = new DatabaseSync(dbPath);
	try {
		db.exec("begin");
		try {
			const result = db.prepare("delete from t_sessions where f_session_id = ?").run(id);
			const removed = Number(result.changes) > 0;
			db.exec("commit");
			return removed;
		} catch (error) {
			try {
				db.exec("rollback");
			} catch {}
			throw error;
		}
	} finally {
		db.close();
	}
}
/**
* Physically remove one session directory. The dir must already be resolved
* from the index (which never follows escaping symlinks); this re-validates
* the realpath against the sessions root before the recursive removal, so no
* caller-supplied path can delete anything outside session storage.
*/
function removeSessionDir(dirPath, sessionsRoot) {
	const rootReal = realpathSync(sessionsRoot);
	const real = realpathSync(dirPath);
	if (!isInside(rootReal, real)) throw new Error(`refusing to remove '${dirPath}': outside the sessions root`);
	rmSync(real, {
		recursive: true,
		force: false
	});
}
//#endregion
//#region src/host/inventory.ts
/**
* Inventory assembly: one pass over the authoritative session feed (host
* SessionController — cold sessions included, agents never activated), the
* workspace registry (membership + archive set), the projection-cache index
* plus per-session projection-cache files (titles, creation facts — the
* index only covers recent sessions), the on-disk session directories
* (sizes, sessions missing from the feed), and the plugin's own archive-time
* ledger. The result is the single document the browser half renders and
* plans against.
* @module @fish-under-sea/dsh-session-archive-fish/host/inventory
*/
/**
* Read and parse the aggregate projection-cache index. A missing or
* unparseable file degrades to an empty index rather than failing the pass.
*/
function readProjcacheIndex(dshHome) {
	const path = join(dshHome, "storages", "session_projcache.json");
	if (!existsSync(path)) return { sessions: {} };
	try {
		return { sessions: JSON.parse(readFileSync(path, "utf8")).tables?.sessions ?? {} };
	} catch {
		return { sessions: {} };
	}
}
function titleFromProjcache(entry) {
	const val = entry.rows?.title?.val;
	return typeof val === "string" && val !== "" ? val : void 0;
}
/**
* Fallback enrichment from one per-session projection-cache file
* (`storages/session_projcache/sessions/<id>.json`). The aggregate index
* only covers recent sessions, so older/archived rows fall back to these
* files for title/createdAt/cwd. Tolerant of version and shape drift; a
* missing or unreadable file yields undefined.
*/
async function readProjcacheFile(dshHome, id, cache) {
	if (cache !== void 0 && cache.has(id)) return cache.get(id) ?? void 0;
	const path = join(dshHome, "storages", "session_projcache", "sessions", `${id}.json`);
	let entry;
	try {
		const parsed = JSON.parse(await readFile(path, "utf8"));
		const record = parsed.record ?? parsed;
		const title = typeof record.rows?.title?.val === "string" && record.rows.title.val !== "" ? record.rows.title.val : void 0;
		const createdAt = typeof record.identity?.createdAt === "number" ? record.identity.createdAt : void 0;
		const cwd = typeof record.identity?.cwd === "string" && record.identity.cwd !== "" ? record.identity.cwd : void 0;
		if (title !== void 0 || createdAt !== void 0 || cwd !== void 0) entry = {
			...title !== void 0 ? { title } : {},
			...createdAt !== void 0 ? { createdAt } : {},
			...cwd !== void 0 ? { cwd } : {}
		};
	} catch {
		entry = void 0;
	}
	if (cache !== void 0) cache.set(id, entry ?? null);
	return entry;
}
/** Ledger entry for a session under either id spelling; canonical wins. */
function ledgerEntryFor(ledger, canonicalId, nativeId) {
	return ledger.entries[canonicalId] ?? (nativeId !== void 0 && nativeId !== canonicalId ? ledger.entries[nativeId] : void 0);
}
/**
* Build the full inventory. Rows exist only for sessions the feed lists or
* the sessions root contains — projection-cache or ledger entries alone never
* conjure a row (no ghosts). Rows from the feed carry reliable last-activity
* times; disk-only rows are flagged `unreadable` metadata.
*/
async function buildInventory(sources, signal) {
	const drafts = /* @__PURE__ */ new Map();
	const nativeIds = {};
	const add = (id) => {
		let draft = drafts.get(id);
		if (draft === void 0) {
			draft = {
				id,
				lastActivityReliable: false,
				running: false,
				blank: false,
				fromFeed: false,
				hasDir: false
			};
			drafts.set(id, draft);
		}
		return draft;
	};
	if (sources.feed !== void 0) try {
		const response = await sources.feed.list({}, signal);
		for (const item of response.items ?? []) {
			if (typeof item.sessionId !== "string" || item.sessionId === "") continue;
			const id = canonicalSessionId(item.sessionId);
			if (id !== item.sessionId && nativeIds[id] === void 0) nativeIds[id] = item.sessionId;
			const draft = add(id);
			draft.fromFeed = true;
			draft.running = item.running === true;
			draft.blank = item.blank === true;
			if (typeof item.updatedAt === "number") {
				draft.lastActivityAt = item.updatedAt;
				draft.lastActivityReliable = true;
			}
			if (typeof item.cwd === "string" && item.cwd !== "") draft.cwd = item.cwd;
			if (typeof item.parentSessionId === "string" && item.parentSessionId !== "") draft.parentId = canonicalSessionId(item.parentSessionId);
			if (item.origin === "subagent") draft.origin = "subagent";
		}
	} catch (error) {
		if (signal.aborted) throw error;
	}
	const dirIndex = sources.dirIndex ?? indexSessionDirs(join(sources.dshHome, "sessions"));
	for (const id of dirIndex.byId.keys()) add(id).hasDir = true;
	const projcache = sources.projcacheIndex ?? readProjcacheIndex(sources.dshHome);
	for (const [id, entry] of Object.entries(projcache.sessions)) {
		const draft = drafts.get(id);
		if (draft === void 0) continue;
		if (draft.title === void 0) draft.title = titleFromProjcache(entry);
		if (draft.createdAt === void 0 && typeof entry.identity?.createdAt === "number") draft.createdAt = entry.identity.createdAt;
		if (draft.cwd === void 0 && typeof entry.identity?.cwd === "string" && entry.identity.cwd !== "") draft.cwd = entry.identity.cwd;
	}
	const workspaces = [];
	const workspaceOf = /* @__PURE__ */ new Map();
	if (sources.registry !== void 0) try {
		for (const entity of sources.registry.list()) {
			workspaces.push({
				id: entity.id,
				title: entity.title,
				path: entity.path,
				sessionIds: [...entity.sessionIds].map(canonicalSessionId)
			});
			for (const sessionId of entity.sessionIds) {
				const list = workspaceOf.get(canonicalSessionId(sessionId));
				if (list === void 0) workspaceOf.set(canonicalSessionId(sessionId), [entity.id]);
				else if (!list.includes(entity.id)) list.push(entity.id);
			}
		}
	} catch {}
	let archivedSessionIds = [];
	if (sources.registry !== void 0) try {
		archivedSessionIds = [...sources.registry.archivedSessionIds];
	} catch {
		archivedSessionIds = [];
	}
	const archivedSet = new Set(archivedSessionIds.map((id) => {
		const canonical = canonicalSessionId(id);
		if (canonical !== id && nativeIds[canonical] === void 0) nativeIds[canonical] = id;
		return canonical;
	}));
	for (const id of archivedSet) if (!drafts.has(id)) add(id);
	for (const draft of drafts.values()) {
		if (draft.title !== void 0 && draft.createdAt !== void 0 && draft.cwd !== void 0) continue;
		if (signal.aborted) throw new Error("inventory aborted");
		const entry = await readProjcacheFile(sources.dshHome, draft.id, sources.projcacheFiles);
		if (entry === void 0) continue;
		if (draft.title === void 0 && entry.title !== void 0) draft.title = entry.title;
		if (draft.createdAt === void 0 && entry.createdAt !== void 0) draft.createdAt = entry.createdAt;
		if (draft.cwd === void 0 && entry.cwd !== void 0) draft.cwd = entry.cwd;
	}
	const childIds = /* @__PURE__ */ new Map();
	for (const draft of drafts.values()) {
		if (draft.parentId === void 0) continue;
		const list = childIds.get(draft.parentId);
		if (list === void 0) childIds.set(draft.parentId, [draft.id]);
		else list.push(draft.id);
	}
	const rows = [];
	for (const draft of drafts.values()) {
		const issues = [];
		if (draft.title === void 0) issues.push("no-title");
		const archived = archivedSet.has(draft.id);
		const archivedAt = (archived ? ledgerEntryFor(sources.ledger, draft.id, nativeIds[draft.id]) : void 0)?.archivedAt;
		if (archived && archivedAt === void 0) issues.push("no-archive-time");
		if (draft.fromFeed === false) issues.push("unreadable");
		if (draft.fromFeed === false && draft.hasDir === false) issues.push("no-data");
		const childList = childIds.get(draft.id) ?? [];
		const sizeBytes = dirIndex.sizes.get(draft.id);
		rows.push({
			id: draft.id,
			...draft.title !== void 0 ? { title: draft.title } : {},
			...draft.createdAt !== void 0 ? { createdAt: draft.createdAt } : {},
			...draft.cwd !== void 0 ? { cwd: draft.cwd } : {},
			workspaceIds: workspaceOf.get(draft.id) ?? [],
			archived,
			...archivedAt !== void 0 ? { archivedAt } : {},
			...draft.lastActivityAt !== void 0 ? { lastActivityAt: draft.lastActivityAt } : {},
			lastActivityReliable: draft.lastActivityReliable,
			...sizeBytes !== void 0 ? { sizeBytes } : {},
			running: draft.running,
			blank: draft.blank,
			...draft.origin !== void 0 ? { origin: draft.origin } : {},
			...draft.parentId !== void 0 ? { parentId: draft.parentId } : {},
			childIds: childList,
			childCount: childList.length,
			issues
		});
	}
	rows.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0) || a.id.localeCompare(b.id));
	return {
		rows,
		workspaces,
		archivedSessionIds,
		dirIndex,
		nativeIds
	};
}
//#endregion
//#region src/host/ledger.ts
/**
* Host-side persistence for dsh-session-archive: the archive-time ledger and
* the automatic-policy run state, both as atomic JSON documents under
* `$DSH_HOME/dsh-session-archive/`. Every write goes through a unique temp
* file + fsync + rename, so an interrupted write can never produce a
* half-written document.
* @module @fish-under-sea/dsh-session-archive-fish/host/ledger
*/
function createLedgerDocument() {
	return {
		version: 1,
		entries: {}
	};
}
/** Tolerant deserialize: corrupt or foreign documents start fresh. */
function deserializeLedger(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return createLedgerDocument();
	}
	if (typeof parsed !== "object" || parsed === null) return createLedgerDocument();
	const doc = parsed;
	if (doc.version !== 1 || typeof doc.entries !== "object" || doc.entries === null) return createLedgerDocument();
	const entries = {};
	for (const [id, value] of Object.entries(doc.entries)) {
		if (typeof value !== "object" || value === null) continue;
		const entry = value;
		if (typeof entry.archivedAt !== "number" || !Number.isFinite(entry.archivedAt)) continue;
		if (entry.source !== "manual" && entry.source !== "auto") continue;
		entries[id] = {
			archivedAt: entry.archivedAt,
			source: entry.source
		};
	}
	return {
		version: 1,
		entries
	};
}
function deserializeAutoState(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { version: 1 };
	}
	if (typeof parsed !== "object" || parsed === null) return { version: 1 };
	const doc = parsed;
	if (doc.version !== 1) return { version: 1 };
	const state = { version: 1 };
	if (isRunStats(doc.lastArchiveRun)) state.lastArchiveRun = doc.lastArchiveRun;
	if (isRunStats(doc.lastDeleteRun)) state.lastDeleteRun = doc.lastDeleteRun;
	if (typeof doc.nextCheckAt === "number" && Number.isFinite(doc.nextCheckAt)) state.nextCheckAt = doc.nextCheckAt;
	return state;
}
function isRunStats(value) {
	if (typeof value !== "object" || value === null) return false;
	const stats = value;
	return typeof stats.at === "number" && typeof stats.total === "number" && typeof stats.ok === "number" && typeof stats.skipped === "number" && typeof stats.failed === "number" && Array.isArray(stats.entries);
}
/** Atomic JSON write: unique temp file, fsync, rename. */
async function writeJsonAtomic(path, value) {
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
	try {
		const handle = await open(temp, "w");
		try {
			await handle.writeFile(JSON.stringify(value, null, 1), "utf8");
			await handle.sync();
		} finally {
			await handle.close();
		}
		await rename(temp, path);
	} catch (error) {
		await unlink(temp).catch(() => {});
		throw error;
	}
}
/** Cap the persisted failure list so state.json stays small. */
function capEntries(entries, cap = 50) {
	return entries.slice(0, cap);
}
//#endregion
//#region src/host/ttl-memo.ts
/**
* One-entry, time-bounded memo for an expensive derivation. The derivation
* runs at most once per window per instance, and {@link invalidate} forces the
* next read to derive again (the owner calls it after its own writes).
*/
var TtlMemo = class {
	ttlMs;
	load;
	now;
	entry;
	loadCount = 0;
	constructor(options) {
		this.ttlMs = options.ttlMs;
		this.load = options.load;
		this.now = options.now ?? (() => Date.now());
	}
	/** The current value: the retained derivation while it is fresh, else a new one. */
	get() {
		const at = this.now();
		const entry = this.entry;
		if (entry !== void 0 && at - entry.at < this.ttlMs && at >= entry.at) return entry.value;
		const value = this.load();
		this.loadCount += 1;
		this.entry = {
			at,
			value
		};
		return value;
	}
	/** Drop the retained value; the next {@link get} derives again. */
	invalidate() {
		this.entry = void 0;
	}
	/** Number of real derivations this instance performed; diagnostics for tests. */
	get loads() {
		return this.loadCount;
	}
};
//#endregion
//#region src/host/dir-index-cache.ts
/**
* One-entry, time-bounded memo for the sessions-root directory index. The scan
* runs at most once per window per instance, and {@link invalidate} forces the
* next read to rescan (the owner calls it after its own removals).
*/
var DirIndexCache = class {
	memo;
	constructor(options) {
		this.memo = new TtlMemo({
			ttlMs: options.ttlMs,
			load: options.scan,
			now: options.now
		});
	}
	/** The current index: the retained scan while it is fresh, else a new one. */
	get() {
		return this.memo.get();
	}
	/** Drop the retained scan; the next {@link get} rescans. */
	invalidate() {
		this.memo.invalidate();
	}
	/** Number of real scans this instance performed; diagnostics for tests. */
	get scans() {
		return this.memo.loads;
	}
};
//#endregion
//#region src/dsh-home.ts
/**
* DSH_HOME resolution shared by the plugin family's Host halves: the
* environment override wins, the platform home fallback follows. Mirrors
* what dsh-pet and dsh-liangshen each used to implement locally.
*/
/** Expand a leading ~ (or ~user) in a path, platform-style. */
function expandHome(path, home = homedir()) {
	const j = home.startsWith("/") ? join$1 : join;
	if (path === "~") return home;
	if (path.startsWith("~/") || path.startsWith("~\\")) return j(home, path.slice(2));
	return path;
}
/**
* Resolve the DSH home directory.
* @param env - process environment to read DSH_HOME from.
* @param home - platform home directory fallback (test seam).
* @returns the absolute DSH home path.
*/
function resolveDshHome(env = process.env, home = homedir()) {
	const isPosix = home.startsWith("/");
	const j = isPosix ? join$1 : join;
	const isAbs = isPosix ? isAbsolute$1 : isAbsolute;
	const raw = env.DSH_HOME;
	if (raw !== void 0 && raw.trim() !== "") {
		const expanded = expandHome(raw.trim(), home);
		return isAbs(expanded) ? expanded : j(process.cwd(), expanded);
	}
	return j(home, ".dsh");
}
/** Resolve the DSH home directory from the live environment. */
function dshHome() {
	return resolveDshHome();
}
//#endregion
//#region src/host/workspace-store.ts
/** Whether the public unarchive verb is present on this registry instance. */
function unarchiveSeamAvailable(registry) {
	return typeof registry?.unarchiveSession === "function";
}
/**
* Remove ids from the registry-global archive set through the public
* `workspaceRegistry.unarchiveSession` verb. Idempotent for ids that are not
* archived (the verb resolves without writing). Callers pass the harness's
* native id spelling, because the stored set mixes spellings.
*/
async function unarchiveSessions(registry, ids) {
	if (ids.length === 0) return;
	const seam = registry;
	if (!unarchiveSeamAvailable(seam)) throw new Error("workspace registry does not expose unarchiveSession");
	for (const id of ids) await seam.unarchiveSession?.(id);
}
/**
* Archive one session through the public verb. Idempotent for already
* archived ids; throws when the session does not exist live or in
* persistence.
*/
async function archiveSession(ctx, id) {
	const registry = ctx.workspaceRegistry;
	if (typeof registry?.archiveSession !== "function") throw new Error("workspace registry does not expose archiveSession");
	await registry.archiveSession(id);
}
/**
* Remove ids from every workspace's durable `sessionIds` account. Goes
* through the entity `mutate` path (durable table update + record refresh +
* feed upsert). Returns the ids actually removed from at least one row.
*/
async function removeFromWorkspaceRows(registry, ids) {
	if (ids.length === 0) return [];
	const seam = registry;
	const drop = new Set(ids.map(canonicalSessionId));
	const matches = (id) => drop.has(canonicalSessionId(id));
	const touched = [];
	let entities;
	try {
		entities = seam.list();
	} catch {
		return [];
	}
	for (const entity of entities) {
		if (typeof entity.mutate !== "function") continue;
		if (!entity.sessionIds.some(matches)) continue;
		await entity.mutate((record) => ({
			...record,
			sessionIds: record.sessionIds.filter((id) => !matches(id))
		}));
		touched.push(entity.id);
	}
	return touched;
}
//#endregion
//#region src/host/janitor.ts
/**
* The dsh-session-archive host service. Owns the archive-time ledger, the
* batch archive/restore/physical-delete pipelines, the automatic policy
* cycles, and the scheduler. Mutating operations serialize through one
* operation lock; every per-session step is failure-isolated so one broken
* session never aborts a batch; physical deletion follows the strict order
* archive markers -> workspace rows -> storage (rdb rows, files) -> projection
* cache -> ledger, so an interrupted batch can only ever leave a session
* present-but-unlisted (retryable), never half-deleted.
* @module @fish-under-sea/dsh-session-archive-fish/host/janitor
*/
/** Thrown when the caller's expected delete total disagrees with the host plan. */
var PlanMismatchError = class extends Error {
	plan;
	constructor(plan) {
		super("delete plan mismatch");
		this.plan = plan;
	}
};
/** Thrown when another mutating operation holds the lock. */
var BusyError = class extends Error {
	constructor() {
		super("another archive operation is running");
	}
};
const PREVIEW_MESSAGE_CAP = 6;
const PREVIEW_TEXT_CAP = 400;
/**
* How long one sessions-root directory scan may be reused. The panel loads the
* inventory, then issues one batch request per chunk (each rebuilding the
* inventory), then refreshes; every one of those passes re-walked the same
* unchanged tree. The window covers that burst without letting a scan go stale
* enough to matter for the sizes and directory map it supplies, and the
* service invalidates the cache itself after a physical delete.
*/
const DIR_INDEX_TTL_MS = 2e3;
/**
* How long one parse of the projection-cache index may be reused. The index is
* re-read and re-parsed in full by every inventory pass, and one action issues
* several passes, so the same burst window as the directory scan applies; once
* the walk is reused the parse is what is left of a warm pass. The service
* invalidates the memo itself after the delete pipeline rewrites the index.
*/
const PROJCACHE_INDEX_TTL_MS = 2e3;
var ArchiveService = class {
	ctx;
	dshHome;
	ledgerPath;
	statePath;
	ledger = {
		version: 1,
		entries: {}
	};
	autoState = { version: 1 };
	config = resolveAutoConfig(void 0);
	/** Per-session projection-cache file facts, memoized across inventory passes. */
	projcacheFiles = /* @__PURE__ */ new Map();
	/**
	* Sessions-root directory index reused across nearby inventory passes. The
	* scan is the dominant cost of a pass, and one user action triggers several
	* (a chunk per batch request plus the refresh that follows). Invalidation
	* after a physical delete keeps the reuse from reporting removed storage.
	*/
	dirIndex = new DirIndexCache({
		ttlMs: DIR_INDEX_TTL_MS,
		scan: () => indexSessionDirs(join(this.dshHome, "sessions"))
	});
	/**
	* Parsed projection-cache index reused across nearby inventory passes. The
	* harness file only changes when another writer touches it, while every pass
	* re-reads and re-parses the whole document; the delete pipeline invalidates
	* the memo after it rewrites the index, so a removed session's facts cannot
	* resurface from memory.
	*/
	projcacheIndex = new TtlMemo({
		ttlMs: PROJCACHE_INDEX_TTL_MS,
		load: () => readProjcacheIndex(this.dshHome)
	});
	loaded = false;
	disposed = false;
	/** Fail-fast flag: mutating operations reject with BusyError while held. */
	lockHeld = false;
	/** Sessions currently inside an archive/restore/delete pipeline. */
	busy = /* @__PURE__ */ new Set();
	cycleRunning = false;
	schedulerTimer;
	constructor(ctx, options = {}) {
		this.ctx = ctx;
		this.dshHome = options.dshHome ?? dshHome();
		this.ledgerPath = join(this.dshHome, "dsh-session-archive", "archive-ledger.json");
		this.statePath = join(this.dshHome, "dsh-session-archive", "state.json");
	}
	async start() {
		const [rawLedger, rawState] = await Promise.all([this.readFile(this.ledgerPath), this.readFile(this.statePath)]);
		if (rawLedger !== void 0) try {
			this.ledger = deserializeLedger(rawLedger);
		} catch {
			this.ledger = {
				version: 1,
				entries: {}
			};
		}
		if (rawState !== void 0) try {
			this.autoState = deserializeAutoState(rawState);
		} catch {
			this.autoState = { version: 1 };
		}
		this.loaded = true;
		this.armScheduler(true);
	}
	stop() {
		this.disposed = true;
		if (this.schedulerTimer !== void 0) clearTimeout(this.schedulerTimer);
		this.schedulerTimer = void 0;
	}
	applyConfig(raw) {
		this.config = resolveAutoConfig(raw);
		if (this.loaded) this.armScheduler(false);
	}
	get autoConfig() {
		return this.config;
	}
	/** Read-only ledger view for tests and diagnostics. */
	ledgerSnapshot() {
		return this.ledger;
	}
	readFile(path) {
		return import("node:fs/promises").then((fs) => fs.readFile(path, "utf8")).catch(() => void 0);
	}
	async flushLedger() {
		if (!this.loaded) return;
		await writeJsonAtomic(this.ledgerPath, this.ledger).catch(() => {});
	}
	async flushState() {
		if (!this.loaded) return;
		await writeJsonAtomic(this.statePath, this.autoState).catch(() => {});
	}
	sources() {
		return {
			feed: this.serviceFace("sessionController"),
			registry: this.serviceFace("workspaceRegistry"),
			dshHome: this.dshHome,
			ledger: this.ledger,
			projcacheFiles: this.projcacheFiles,
			dirIndex: this.dirIndex.get(),
			projcacheIndex: this.projcacheIndex.get()
		};
	}
	serviceFace(name) {
		try {
			return this.ctx.get(name);
		} catch {
			return;
		}
	}
	/** Live session ids (attached in this host process) — treated as in-use. */
	liveSessionIds() {
		const store = this.serviceFace("sessions");
		const ids = /* @__PURE__ */ new Set();
		if (store === void 0 || typeof store.list !== "function") return ids;
		try {
			for (const session of store.list() ?? []) {
				const id = session?.id;
				if (typeof id === "string") ids.add(canonicalSessionId(id));
			}
		} catch {}
		return ids;
	}
	/** Protection map shared by manual delete and auto cycles. */
	protectedReason(currentSessionId, rows) {
		const map = /* @__PURE__ */ new Map();
		for (const id of this.liveSessionIds()) map.set(id, "attached");
		if (rows !== void 0) {
			for (const row of rows) if (row.running && !map.has(row.id)) map.set(row.id, "running");
		}
		if (currentSessionId !== void 0 && currentSessionId !== "") map.set(canonicalSessionId(currentSessionId), "current");
		for (const id of this.busy) map.set(id, "in-flight");
		return map;
	}
	statsFrom(results, at) {
		let ok = 0;
		let skipped = 0;
		let failed = 0;
		const entries = [];
		for (const result of results) if (result.status === "ok") ok += 1;
		else if (result.status === "skipped") {
			skipped += 1;
			entries.push(result);
		} else {
			failed += 1;
			entries.push(result);
		}
		return {
			at,
			total: results.length,
			ok,
			skipped,
			failed,
			entries: capEntries(entries)
		};
	}
	async inventory() {
		const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
		const workspaces = built.workspaces;
		return {
			generatedAt: Date.now(),
			rows: built.rows,
			workspaces,
			archivedSessionIds: built.archivedSessionIds,
			auto: this.autoView()
		};
	}
	autoView() {
		return {
			...this.autoState.lastArchiveRun !== void 0 ? { lastArchiveRun: this.autoState.lastArchiveRun } : {},
			...this.autoState.lastDeleteRun !== void 0 ? { lastDeleteRun: this.autoState.lastDeleteRun } : {},
			...this.autoState.nextCheckAt !== void 0 ? { nextCheckAt: this.autoState.nextCheckAt } : {},
			cycleRunning: this.cycleRunning
		};
	}
	/** Fail-fast mutual exclusion: concurrent mutating callers get BusyError. */
	withLock(fn) {
		if (this.lockHeld) return Promise.reject(new BusyError());
		this.lockHeld = true;
		const run = (async () => fn())();
		const release = () => {
			this.lockHeld = false;
		};
		run.then(release, release);
		return run;
	}
	async archive(ids, source, currentSessionId) {
		return this.withLock(async () => {
			const results = [];
			const now = Date.now();
			const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
			const byId = new Map(built.rows.map((row) => [row.id, row]));
			for (const id of ids) {
				const row = byId.get(id);
				if (row === void 0) {
					results.push({
						id,
						status: "skipped",
						reason: "not-found"
					});
					continue;
				}
				if (row.archived) {
					results.push({
						id,
						status: "skipped",
						reason: "already-archived"
					});
					continue;
				}
				if (source === "auto") {
					const reason = this.protectedReason(currentSessionId, built.rows).get(id);
					if (reason !== void 0) {
						results.push({
							id,
							status: "skipped",
							reason
						});
						continue;
					}
				}
				this.busy.add(id);
				try {
					await archiveSession(this.ctx, built.nativeIds[id] ?? id);
					this.ledger.entries[id] = {
						archivedAt: now,
						source
					};
					results.push({
						id,
						status: "ok"
					});
				} catch (error) {
					results.push({
						id,
						status: "failed",
						reason: "error",
						detail: error instanceof Error ? error.message.slice(0, 200) : String(error)
					});
				} finally {
					this.busy.delete(id);
				}
			}
			await this.flushLedger();
			return {
				results,
				freedBytes: 0
			};
		});
	}
	async unarchive(ids) {
		return this.withLock(async () => {
			const results = [];
			const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
			const byId = new Map(built.rows.map((row) => [row.id, row]));
			const toUnarchive = [];
			for (const id of ids) {
				const row = byId.get(id);
				if (row === void 0) {
					results.push({
						id,
						status: "skipped",
						reason: "not-found"
					});
					continue;
				}
				if (!row.archived) {
					results.push({
						id,
						status: "skipped",
						reason: "not-archived"
					});
					continue;
				}
				toUnarchive.push(id);
			}
			try {
				await unarchiveSessions(this.ctx.workspaceRegistry, toUnarchive.map((id) => built.nativeIds[id] ?? id));
				for (const id of toUnarchive) {
					delete this.ledger.entries[id];
					const native = built.nativeIds[id];
					if (native !== void 0 && native !== id) delete this.ledger.entries[native];
					results.push({
						id,
						status: "ok"
					});
				}
			} catch (error) {
				for (const id of toUnarchive) results.push({
					id,
					status: "failed",
					reason: "missing-seam",
					detail: error instanceof Error ? error.message.slice(0, 200) : String(error)
				});
			}
			await this.flushLedger();
			return {
				results,
				freedBytes: 0
			};
		});
	}
	/**
	* Plan and execute one physical-delete batch. The plan is computed from a
	* fresh inventory with the full protection map; `expectedTotal` (the number
	* the user confirmed) must match or the whole batch aborts with a plan
	* mismatch so the UI can re-confirm.
	*/
	async deleteSessions(ids, options = {}) {
		return this.withLock(async () => {
			const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
			const protectedMap = this.protectedReason(options.currentSessionId, built.rows);
			const plan = planDelete(built.rows, ids, protectedMap);
			if (typeof options.expectedTotal === "number" && plan.targets.length > options.expectedTotal) throw new PlanMismatchError(plan);
			if (!unarchiveSeamAvailable(this.ctx.workspaceRegistry)) return {
				results: plan.targets.map((id) => ({
					id,
					status: "failed",
					reason: "missing-seam",
					detail: "workspace registry seam unavailable"
				})),
				freedBytes: 0
			};
			for (const id of plan.targets) this.busy.add(id);
			try {
				return await this.executeDelete(plan, built, options.source ?? "manual");
			} finally {
				for (const id of plan.targets) this.busy.delete(id);
			}
		});
	}
	/**
	* The deletion pipeline, in the crash-safe order: archive markers, then
	* workspace rows, then per-session storage (rdb rows and files), then the
	* projection cache, then the archive ledger. A crash between steps leaves
	* the session unlisted but present — a retry finishes the job; it never
	* leaves a half-deleted session behind.
	*/
	async executeDelete(plan, built, source) {
		const results = /* @__PURE__ */ new Map();
		const targets = plan.targets;
		const sizeById = new Map(built.rows.map((row) => [row.id, row.sizeBytes]));
		try {
			await unarchiveSessions(this.ctx.workspaceRegistry, targets.map((id) => built.nativeIds[id] ?? id));
		} catch (error) {
			const detail = error instanceof Error ? error.message.slice(0, 200) : String(error);
			return {
				results: targets.map((id) => ({
					id,
					status: "failed",
					reason: "missing-seam",
					detail
				})),
				freedBytes: 0
			};
		}
		try {
			await removeFromWorkspaceRows(this.ctx.workspaceRegistry, targets);
		} catch {}
		const rdbPaths = rdbDbPaths(this.dshHome).filter((path) => isSessionRdb(path));
		const rowById = new Map(built.rows.map((row) => [row.id, row]));
		const deleted = /* @__PURE__ */ new Set();
		for (const id of targets) try {
			const native = built.nativeIds[id];
			for (const dbPath of rdbPaths) {
				deleteRdbSession(dbPath, id);
				if (native !== void 0 && native !== id) deleteRdbSession(dbPath, native);
			}
			const dir = built.dirIndex.byId.get(id);
			if (dir !== void 0) removeSessionDir(dir, join(this.dshHome, "sessions"));
			else if (rdbPaths.length === 0 && rowById.get(id)?.issues.includes("no-data") !== true) {
				results.set(id, {
					id,
					status: "failed",
					reason: "unreadable",
					detail: "no session storage found"
				});
				continue;
			}
			deleted.add(id);
			results.set(id, {
				id,
				status: "ok"
			});
		} catch (error) {
			results.set(id, {
				id,
				status: "failed",
				reason: "error",
				detail: error instanceof Error ? error.message.slice(0, 200) : String(error)
			});
		}
		if (deleted.size > 0) this.dirIndex.invalidate();
		await this.scrubProjcache(deleted, built.nativeIds);
		for (const id of deleted) {
			delete this.ledger.entries[id];
			const native = built.nativeIds[id];
			if (native !== void 0 && native !== id) delete this.ledger.entries[native];
		}
		await this.flushLedger();
		let freedBytes = 0;
		for (const id of deleted) {
			const size = sizeById.get(id);
			if (typeof size === "number") freedBytes += size;
		}
		return {
			results: [...plan.skipped, ...targets.map((id) => results.get(id) ?? {
				id,
				status: "failed",
				reason: "error"
			})],
			freedBytes
		};
	}
	/** Best-effort projection-cache scrub; a stale cache entry is cosmetic. */
	async scrubProjcache(ids, nativeIds = {}) {
		const indexPath = join(this.dshHome, "storages", "session_projcache.json");
		if (ids.size > 0) this.projcacheIndex.invalidate();
		try {
			if (existsSync(indexPath)) {
				const parsed = JSON.parse(this.readSync(indexPath));
				const sessions = parsed.tables?.sessions;
				if (sessions !== void 0) {
					for (const id of ids) {
						delete sessions[id];
						const native = nativeIds[id];
						if (native !== void 0 && native !== id) delete sessions[native];
					}
					await writeJsonAtomic(indexPath, parsed);
				}
			}
		} catch {}
		const perSessionDir = join(this.dshHome, "storages", "session_projcache", "sessions");
		try {
			for (const id of ids) for (const spelling of [id, nativeIds[id]]) {
				if (spelling === void 0) continue;
				const file = join(perSessionDir, `${spelling}.json`);
				if (existsSync(file)) unlinkSync(file);
			}
		} catch {}
	}
	readSync(path) {
		return readFileSync(path, "utf8");
	}
	async autoPreview() {
		const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
		const now = Date.now();
		const protectedSet = new Set(this.protectedReason(void 0, built.rows).keys());
		const archiveCandidates = this.config.autoArchiveEnabled ? autoArchiveCandidates(built.rows, {
			days: this.config.autoArchiveDays,
			now,
			protectedIds: protectedSet
		}) : [];
		const deleteSeeds = this.config.autoDeleteEnabled ? autoDeleteSeedCandidates(built.rows, {
			retainDays: this.config.autoDeleteDays,
			now,
			runStartedAt: now,
			protectedIds: protectedSet
		}) : [];
		const plan = planDelete(built.rows, deleteSeeds.map((seed) => seed.id), this.protectedReason(void 0, built.rows));
		let deleteBytes = 0;
		for (const id of plan.targets) {
			const size = built.rows.find((row) => row.id === id)?.sizeBytes;
			if (typeof size === "number") deleteBytes += size;
		}
		return {
			archiveCandidates,
			deleteCandidates: plan.targets.map((id) => {
				const row = built.rows.find((entry) => entry.id === id);
				return {
					id,
					archivedAt: row?.archivedAt ?? 0,
					...row?.sizeBytes !== void 0 ? { sizeBytes: row.sizeBytes } : {}
				};
			}),
			deleteBytes
		};
	}
	/**
	* Run one automatic cycle now (scheduler tick or manual trigger). The two
	* policies are independent: archive seeds from last-activity, delete seeds
	* from the recorded archive time strictly before this cycle started, so a
	* session archived by this very cycle is never deleted in it.
	*/
	async runAutoCycle(kind, currentSessionId) {
		return this.withLock(async () => {
			this.cycleRunning = true;
			const startedAt = Date.now();
			try {
				if (kind === "archive") {
					const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
					const protectedSet = new Set(this.protectedReason(currentSessionId, built.rows).keys());
					const candidates = autoArchiveCandidates(built.rows, {
						days: this.config.autoArchiveDays,
						now: startedAt,
						protectedIds: protectedSet
					});
					const response = await this.archiveInternal(candidates.map((entry) => entry.id), "auto", built.nativeIds);
					const stats = this.statsFrom(response.results, startedAt);
					this.autoState.lastArchiveRun = stats;
					await this.flushState();
					return stats;
				}
				const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
				const protectedMap = this.protectedReason(currentSessionId, built.rows);
				const protectedSet = new Set(protectedMap.keys());
				const seeds = autoDeleteSeedCandidates(built.rows, {
					retainDays: this.config.autoDeleteDays,
					now: startedAt,
					runStartedAt: startedAt,
					protectedIds: protectedSet
				});
				if (seeds.length === 0) {
					const stats = {
						at: startedAt,
						total: 0,
						ok: 0,
						skipped: 0,
						failed: 0,
						entries: []
					};
					this.autoState.lastDeleteRun = stats;
					await this.flushState();
					return stats;
				}
				const plan = planDelete(built.rows, seeds.map((seed) => seed.id), protectedMap);
				const response = await this.executeDelete(plan, built, "auto");
				const stats = this.statsFrom(response.results, startedAt);
				this.autoState.lastDeleteRun = stats;
				await this.flushState();
				return stats;
			} finally {
				this.cycleRunning = false;
			}
		});
	}
	/** Archive without re-acquiring the lock (used inside cycles). */
	async archiveInternal(ids, source, nativeIds) {
		const results = [];
		const now = Date.now();
		for (const id of ids) {
			this.busy.add(id);
			try {
				await archiveSession(this.ctx, nativeIds[id] ?? id);
				this.ledger.entries[id] = {
					archivedAt: now,
					source
				};
				results.push({
					id,
					status: "ok"
				});
			} catch (error) {
				results.push({
					id,
					status: "failed",
					reason: "error",
					detail: error instanceof Error ? error.message.slice(0, 200) : String(error)
				});
			} finally {
				this.busy.delete(id);
			}
		}
		await this.flushLedger();
		return {
			results,
			freedBytes: 0
		};
	}
	armScheduler(catchUp) {
		if (this.schedulerTimer !== void 0) clearTimeout(this.schedulerTimer);
		if (this.disposed) return;
		const intervalMs = Math.max(15, this.config.checkIntervalMin) * 6e4;
		const due = this.autoState.nextCheckAt;
		const delay = catchUp && due !== void 0 && due <= Date.now() ? 2e3 : Math.max(2e3, due === void 0 ? intervalMs : due - Date.now());
		this.autoState.nextCheckAt = Date.now() + delay;
		this.flushState();
		this.schedulerTimer = setTimeout(() => {
			this.tick();
		}, delay);
	}
	async tick() {
		if (this.disposed) return;
		if (this.config.autoArchiveEnabled || this.config.autoDeleteEnabled) {
			const currentSessionId = void 0;
			try {
				if (this.config.autoArchiveEnabled) await this.runAutoCycle("archive", currentSessionId);
			} catch (error) {
				if (!(error instanceof BusyError)) {
					this.autoState.lastArchiveRun = {
						at: Date.now(),
						total: 0,
						ok: 0,
						skipped: 0,
						failed: 1,
						entries: [{
							id: "cycle",
							status: "failed",
							reason: "error",
							detail: error instanceof Error ? error.message.slice(0, 200) : String(error)
						}]
					};
					await this.flushState();
				}
			}
			try {
				if (this.config.autoDeleteEnabled) await this.runAutoCycle("delete", currentSessionId);
			} catch (error) {
				if (!(error instanceof BusyError)) {
					this.autoState.lastDeleteRun = {
						at: Date.now(),
						total: 0,
						ok: 0,
						skipped: 0,
						failed: 1,
						entries: [{
							id: "cycle",
							status: "failed",
							reason: "error",
							detail: error instanceof Error ? error.message.slice(0, 200) : String(error)
						}]
					};
					await this.flushState();
				}
			}
		}
		this.autoState.nextCheckAt = Date.now() + Math.max(15, this.config.checkIntervalMin) * 6e4;
		await this.flushState();
		this.armScheduler(false);
	}
	async preview(id) {
		const controller = this.serviceFace("sessionController");
		const built = await buildInventory(this.sources(), AbortSignal.timeout(3e4));
		const row = built.rows.find((entry) => entry.id === id);
		if (row === void 0) throw new Error("session not found");
		let meta = {
			createdAt: row.createdAt,
			cwd: row.cwd
		};
		let excerpt = [];
		let messageCount = 0;
		if (controller !== void 0 && typeof controller.inspect === "function") try {
			const inspect = await controller.inspect(built.nativeIds[id] ?? id, AbortSignal.timeout(15e3));
			if (meta.createdAt === void 0 && inspect.meta?.createdAt !== void 0) meta = {
				...meta,
				createdAt: inspect.meta.createdAt
			};
			if (meta.cwd === void 0 && inspect.meta?.cwd !== void 0) meta = {
				...meta,
				cwd: inspect.meta.cwd
			};
			const messages = extractMessages(inspect.events ?? []);
			messageCount = messages.total;
			excerpt = messages.excerpt;
		} catch {}
		return {
			id,
			...row.title !== void 0 ? { title: row.title } : {},
			...meta.createdAt !== void 0 ? { createdAt: meta.createdAt } : {},
			...meta.cwd !== void 0 ? { cwd: meta.cwd } : {},
			...row.sizeBytes !== void 0 ? { sizeBytes: row.sizeBytes } : {},
			messageCount,
			excerpt
		};
	}
};
/**
* Tolerant message extraction from session events: user/assistant message
* events with string or block-array content. Unknown shapes are ignored, so
* a malformed event never breaks the preview.
*/
function extractMessages(events) {
	const excerpt = [];
	let total = 0;
	for (const event of events) {
		if (typeof event !== "object" || event === null) continue;
		const record = event;
		if (typeof record.type !== "string") continue;
		if (record.type !== "user/message" && record.type !== "assistant/message") continue;
		const text = messageText(record.data);
		if (text === void 0) continue;
		total += 1;
		if (excerpt.length < PREVIEW_MESSAGE_CAP) excerpt.push({
			role: record.type === "user/message" ? "user" : "assistant",
			text: text.length > PREVIEW_TEXT_CAP ? `${text.slice(0, PREVIEW_TEXT_CAP)}…` : text
		});
	}
	return {
		total,
		excerpt
	};
}
function messageText(data) {
	if (typeof data === "string") return data;
	if (typeof data !== "object" || data === null) return void 0;
	const record = data;
	if (typeof record.text === "string") return record.text;
	const content = record.content ?? record.message;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const parts = [];
		for (const block of content) if (typeof block === "string") parts.push(block);
		else if (typeof block === "object" && block !== null && typeof block.text === "string") parts.push(block.text);
		const joined = parts.join("\n").trim();
		return joined === "" ? void 0 : joined;
	}
}
//#endregion
//#region src/host/http.ts
/** Family-default JSON response headers; callers may append or override. */
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"referrer-policy": "no-referrer"
};
/**
* Strict bounded body reader: parse a request body of at most maxBytes as
* JSON.
* @throws 'body too large' past the cap, or the JSON.parse error for an
*   invalid or empty payload.
*/
async function readBoundedJson(req, maxBytes) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) throw new Error("body too large");
		chunks.push(buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
/**
* Write one JSON response. Default headers are the family defaults
* (content-type and referrer-policy); caller headers are appended or
* override them.
*/
function writeJson(res, status, body, headers = {}) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		...JSON_HEADERS,
		...headers
	});
	res.end(payload);
}
//#endregion
//#region src/host/loopback.ts
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
/**
* Request-level trust fence: a loopback socket address AND a loopback Host
* header, plus browser same-origin markers. The socket address is
* authoritative; X-Forwarded-For is never trusted.
*/
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/host/routes.ts
const ARCHIVE_API_PREFIX = "/api/dsh-session-archive";
/** Batch bodies carry id arrays; 4 MiB covers ~50k ids with margin. */
const BODY_MAX_BYTES = 4e6;
function fenced(req, res) {
	if (!isLoopbackRequest(req)) {
		writeJson(res, 403, {
			ok: false,
			error: "forbidden: loopback-only"
		});
		return false;
	}
	return true;
}
async function readBody(req) {
	try {
		return await readBoundedJson(req, BODY_MAX_BYTES);
	} catch {
		return {};
	}
}
function idList(value) {
	if (!Array.isArray(value)) return [];
	const out = [];
	for (const entry of value) {
		if (typeof entry !== "string" || entry.length === 0 || entry.length > 200) continue;
		if (entry.includes("/") || entry.includes("\\") || entry.includes("..")) continue;
		out.push(canonicalSessionId(entry));
	}
	return out;
}
function batchBody(body) {
	const record = typeof body === "object" && body !== null ? body : {};
	return {
		ids: idList(record.ids),
		...typeof record.currentSessionId === "string" ? { currentSessionId: record.currentSessionId } : {},
		...typeof record.expectedTotal === "number" && Number.isFinite(record.expectedTotal) ? { expectedTotal: Math.round(record.expectedTotal) } : {}
	};
}
function errorDetail(error) {
	return error instanceof Error ? error.message.slice(0, 300) : String(error);
}
function makeInventoryRoute(service) {
	return {
		kind: "exact",
		path: `${ARCHIVE_API_PREFIX}/inventory`,
		handler: async (req, res) => {
			if (!fenced(req, res)) return;
			try {
				writeJson(res, 200, await service.inventory(), { "cache-control": "no-store" });
			} catch (error) {
				writeJson(res, 500, {
					ok: false,
					error: errorDetail(error)
				});
			}
		}
	};
}
function makePreviewRoute(service) {
	return {
		kind: "exact",
		path: `${ARCHIVE_API_PREFIX}/preview`,
		handler: async (req, res) => {
			if (!fenced(req, res)) return;
			const id = new URL(req.url ?? "/", "http://localhost").searchParams.get("id") ?? "";
			if (!id.startsWith("session-")) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid session id"
				});
				return;
			}
			try {
				writeJson(res, 200, await service.preview(id), { "cache-control": "no-store" });
			} catch (error) {
				writeJson(res, 404, {
					ok: false,
					error: errorDetail(error)
				});
			}
		}
	};
}
function batchRoute(service, path, run) {
	return {
		kind: "exact",
		path,
		handler: async (req, res) => {
			if (!fenced(req, res)) return;
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			let body;
			try {
				body = batchBody(await readBody(req));
			} catch (error) {
				writeJson(res, 400, {
					ok: false,
					error: errorDetail(error)
				});
				return;
			}
			if (body.ids.length === 0) {
				writeJson(res, 400, {
					ok: false,
					error: "no session ids"
				});
				return;
			}
			if (body.ids.length > 2e4) {
				writeJson(res, 413, {
					ok: false,
					error: "too many session ids"
				});
				return;
			}
			try {
				writeJson(res, 200, await run(body), { "cache-control": "no-store" });
			} catch (error) {
				if (error instanceof BusyError) {
					writeJson(res, 409, {
						ok: false,
						error: "busy: another archive operation is running"
					});
					return;
				}
				if (error instanceof PlanMismatchError) {
					writeJson(res, 409, {
						error: "plan-mismatch",
						plan: error.plan
					});
					return;
				}
				writeJson(res, 500, {
					ok: false,
					error: errorDetail(error)
				});
			}
		}
	};
}
function makeArchiveRoute(service) {
	return batchRoute(service, `${ARCHIVE_API_PREFIX}/archive`, (body) => service.archive(body.ids, "manual", body.currentSessionId));
}
function makeUnarchiveRoute(service) {
	return batchRoute(service, `${ARCHIVE_API_PREFIX}/unarchive`, (body) => service.unarchive(body.ids));
}
function makeDeleteRoute(service) {
	return batchRoute(service, `${ARCHIVE_API_PREFIX}/delete`, (body) => service.deleteSessions(body.ids, {
		currentSessionId: body.currentSessionId,
		...body.expectedTotal !== void 0 ? { expectedTotal: body.expectedTotal } : {}
	}));
}
function makeAutoPreviewRoute(service) {
	return {
		kind: "exact",
		path: `${ARCHIVE_API_PREFIX}/auto/preview`,
		handler: async (req, res) => {
			if (!fenced(req, res)) return;
			try {
				writeJson(res, 200, await service.autoPreview(), { "cache-control": "no-store" });
			} catch (error) {
				writeJson(res, 500, {
					ok: false,
					error: errorDetail(error)
				});
			}
		}
	};
}
function makeAutoRunRoute(service) {
	return {
		kind: "exact",
		path: `${ARCHIVE_API_PREFIX}/auto/run`,
		handler: async (req, res) => {
			if (!fenced(req, res)) return;
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			let kind;
			let currentSessionId;
			try {
				const body = await readBody(req);
				if (body.kind !== "archive" && body.kind !== "delete") throw new Error("kind must be archive or delete");
				kind = body.kind;
				if (typeof body.currentSessionId === "string") currentSessionId = body.currentSessionId;
			} catch (error) {
				writeJson(res, 400, {
					ok: false,
					error: errorDetail(error)
				});
				return;
			}
			try {
				writeJson(res, 200, {
					ok: true,
					stats: await service.runAutoCycle(kind, currentSessionId)
				}, { "cache-control": "no-store" });
			} catch (error) {
				if (error instanceof BusyError) {
					writeJson(res, 409, {
						ok: false,
						error: "busy: another archive operation is running"
					});
					return;
				}
				writeJson(res, 500, {
					ok: false,
					error: errorDetail(error)
				});
			}
		}
	};
}
function makeArchiveRoutes(service) {
	return [
		makeInventoryRoute(service),
		makePreviewRoute(service),
		makeArchiveRoute(service),
		makeUnarchiveRoute(service),
		makeDeleteRoute(service),
		makeAutoPreviewRoute(service),
		makeAutoRunRoute(service)
	];
}
//#endregion
//#region src/index.ts
const name = "dsh-session-archive";
const inject = ["webServer", "workspaceRegistry"];
/**
* The plugin's own settings, served by the Host as this profile entry's
* configuration page. Every field is volatile: a settings write commits a new
* value into the running activation's references (see the
* `loader/volatile-update` listener in {@link apply}) instead of remounting the
* row, which is what keeps the archive service, its ledger and its scheduler
* alive across a settings change.
*/
const Config = z.object({
	enabled: z.boolean().default(true).volatile(),
	autoArchiveEnabled: z.boolean().default(false).volatile(),
	autoArchiveDays: z.number().min(1).max(3650).default(7).volatile(),
	autoDeleteEnabled: z.boolean().default(false).volatile(),
	autoDeleteDays: z.number().min(1).max(3650).default(7).volatile(),
	checkIntervalMin: z.number().min(15).max(1440).default(60).volatile()
});
const apply = mountOnce("@fish-under-sea/dsh-session-archive-fish", (ctx, config) => {
	let service;
	let disposeRoutes;
	/**
	* Apply the activation's current settings: unmount the whole surface when
	* disabled, otherwise mount it on first use and hand the service the values.
	* Volatile references are read here, so every re-arm sees the latest
	* committed settings.
	*/
	const rearm = () => {
		const value = readArchiveConfig(config);
		if (!resolveAutoConfig(value).enabled) {
			service?.stop();
			service = void 0;
			disposeRoutes?.();
			disposeRoutes = void 0;
			return;
		}
		if (service === void 0) {
			const next = new ArchiveService(ctx);
			service = next;
			next.start();
			const disposers = makeArchiveRoutes(next).map((route) => ctx.webServer.register(route));
			disposeRoutes = () => {
				for (const dispose of disposers) try {
					dispose();
				} catch {}
			};
		}
		service?.applyConfig(value);
	};
	ctx.on("loader/volatile-update", () => {
		rearm();
	});
	ctx.effect(() => {
		rearm();
		return () => {
			disposeRoutes?.();
			service?.stop();
			service = void 0;
		};
	}, "dsh-session-archive: runtime");
});
//#endregion
export { Config, apply, inject, name };
