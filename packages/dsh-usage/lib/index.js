import z from "@deepseek-ai/schemastery";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import "@deepseek-ai/cordis";
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
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-brand@0.2.0-rc.2_@deepseek-ai+cordis@4.0.4/node_modules/@deepseek-ai/dsh-brand/lib/index.js
/**
* Duplicate-install-safe nominal primitive helpers.
*
* A brand makes structurally identical strings or numbers non-interchangeable
* at the type level: a `SessionId` cannot be passed where a `ToolCallId` is
* expected, and an event sequence cannot be passed as a log offset. Comparison,
* logging, and serialization retain the underlying primitive behavior.
*
* This package owns no concrete domain value and keeps no runtime identity or mutable
* state, so independently installed copies produce interchangeable values.
*
* @module @deepseek-ai/dsh-brand
*/
/**
* Apply a compile-time string brand without changing the value.
* @param value - string admitted by the domain that owns the target brand.
* @returns the same string with the requested compile-time brand.
*/
function brandString(value) {
	return value;
}
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-credential_13783eb73d2217c5a4a149b781a9cc49/node_modules/@deepseek-ai/dsh-credentials/lib/index.js
/**
* Service Definition for the credential-reference capability seam (`ctx.credentials`). Settings and composition files carry
* *references* to secrets — environment-variable names — while providers own
* the actual values and their storage. Consumers resolve a reference once per
* operation, so a changed credential reaches the next operation without any
* plugin restart, and configuration surfaces describe a reference without
* ever seeing its value.
* @module @deepseek-ai/dsh-credentials
*/
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Both halves of a {@link CredentialKey}; the `/` between them is what keeps it out of {@link REF_PATTERN}. */
const KEY_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
/**
* Brand a raw string as a {@link CredentialRef}.
* @param value - candidate reference; a POSIX shell identifier such as `DEEPSEEK_API_KEY`.
* @returns the branded reference.
*/
function credentialRef(value) {
	if (!isCredentialRefName(value)) throw new TypeError(`credential ref "${value}" must match ${String(REF_PATTERN)}`);
	return brandString(value);
}
/**
* Whether a raw string could name a reference at all. Consumers that receive
* environment-variable names from somewhere else — a provider library's own
* ambient discovery, a hook payload — ask this before resolving, because a name
* outside the grammar has no reference to miss and should read as "not set"
* rather than as a thrown error.
* @param value - candidate reference.
* @returns true when {@link credentialRef} would accept it.
*/
function isCredentialRefName(value) {
	return REF_PATTERN.test(value);
}
/**
* Brand a scope and an id as a {@link CredentialKey}.
* @param scope - the owning plugin's registered name, such as `llm-pi-ai`.
* @param id - that plugin's own addressing unit, such as a provider route key.
* @returns the branded key.
* @throws TypeError when either segment is not a lowercase hyphenated identifier.
*/
function credentialKey(scope, id) {
	for (const segment of [scope, id]) if (!KEY_SEGMENT_PATTERN.test(segment)) throw new TypeError(`credential key segment "${segment}" must match ${String(KEY_SEGMENT_PATTERN)}`);
	return brandString(`${scope}/${id}`);
}
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
//#region src/host/http.ts
/** Family-default JSON response headers; callers may append or override. */
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"referrer-policy": "no-referrer"
};
/**
* Request init that asks a remote origin for an uncompressed body.
*
* The DSH host boots `@deepseek-ai/dsh-http-proxy`, whose top-level import of
* the npm `undici` copy replaces the legacy `undici.globalDispatcher.1` slot
* Node's built-in `fetch()` reads. That cross-major wrapper drops the
* `content-encoding` header and automatic decompression, so a plain fetch
* resolves to raw gzip/brotli/zstd bytes — compressed noise no JSON or text
* consumer can read. Every host fetch that parses a remote body must request
* identity encoding. Caller headers survive; `accept-encoding` is forced to
* `identity` because a caller value has no decoder behind it in this host.
* @param init - the caller's request init (signal, headers, method, ...).
* @returns a copy with `accept-encoding: identity` merged in.
*/
function withIdentityEncoding(init = {}) {
	const headers = new Headers(init.headers);
	headers.set("accept-encoding", "identity");
	return {
		...init,
		headers
	};
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
//#region src/core/adapters.ts
/** Parse a string/number into a finite number, else undefined. */
function toNum(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : void 0;
	}
}
/** Read a string field that must be a non-empty string. */
function str(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
/** Clamp a provider percentage into the renderable 0-100 band. */
function clampPercent(value) {
	return Math.max(0, Math.min(100, value));
}
/** Format a number to a fixed 2-decimal display string. */
function money(value) {
	return value.toFixed(2);
}
/** Millisecond epoch or ISO string → normalized ISO 8601, else undefined. */
function toIso(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		const ms = value < 0xe8d4a51000 ? value * 1e3 : value;
		const date = new Date(ms);
		return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
	}
	const text = str(value);
	if (text === void 0) return void 0;
	if (/^\d+$/.test(text)) return toIso(Number(text));
	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
}
/** Used-percent helper guarding zero/absent limits. */
function usedPercent(used, limit) {
	const usedNum = toNum(used);
	const limitNum = toNum(limit);
	if (usedNum === void 0 || limitNum === void 0 || limitNum <= 0) return void 0;
	return Math.max(0, Math.min(100, usedNum / limitNum * 100));
}
function bearer(apiKey) {
	return { authorization: `Bearer ${apiKey}` };
}
const DEEPSEEK = {
	ids: ["deepseek", "deepseek-official"],
	familyOnlyIds: ["deepseek-account"],
	displayName: "DeepSeek",
	balance: {
		origin: "https://api.deepseek.com",
		build: ({ apiKey }) => ({
			url: "https://api.deepseek.com/user/balance",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const infos = body.balance_infos;
			if (!Array.isArray(infos) || infos.length === 0) return void 0;
			const first = infos[0];
			if (typeof first !== "object" || first === null) return void 0;
			const currency = str(first.currency);
			const total = str(first.total_balance);
			if (currency === void 0 || total === void 0) return void 0;
			return {
				currency,
				totalBalance: total
			};
		}
	}
};
/** Moonshot pay-as-you-go balance; CN bills in CNY, international in USD. */
function moonshotBalance(host, currency, ids) {
	return {
		ids,
		displayName: "Moonshot AI",
		balance: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/users/me/balance`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const data = body.data;
				if (typeof data !== "object" || data === null) return void 0;
				const available = toNum(data.available_balance);
				if (available === void 0) return void 0;
				return {
					currency,
					totalBalance: money(available)
				};
			}
		}
	};
}
/** Kimi For Coding quota: top-level `usage` is the weekly summary, `limits[]` the per-window rows. */
const KIMI_CODING = {
	ids: ["kimi-coding"],
	displayName: "Kimi For Coding",
	plan: {
		build: ({ apiKey }) => ({
			url: "https://api.kimi.com/coding/v1/usages",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const root = body;
			const windows = [];
			const limits = root.limits;
			if (Array.isArray(limits)) for (const entry of limits) {
				if (typeof entry !== "object" || entry === null) continue;
				const detail = entry.detail;
				const window = entry.window;
				if (typeof detail !== "object" || detail === null) continue;
				const row = detail;
				const duration = typeof window === "object" && window !== null ? toNum(window.duration) : void 0;
				const unit = typeof window === "object" && window !== null ? str(window.timeUnit) : void 0;
				const key = duration === 300 && unit === "TIME_UNIT_MINUTE" ? "5h" : duration !== void 0 ? `w-${duration}` : "window";
				const percent = usedPercent(row.used, row.limit);
				windows.push({
					key,
					name: str(row.name),
					percent,
					resetsAt: toIso(row.resetTime)
				});
			}
			const usage = root.usage;
			if (typeof usage === "object" && usage !== null) {
				const weekly = usage;
				windows.push({
					key: "week",
					name: "Weekly",
					percent: usedPercent(weekly.used, weekly.limit),
					resetsAt: toIso(weekly.resetTime)
				});
			}
			if (windows.length === 0) return void 0;
			const user = root.user;
			const membership = typeof user === "object" && user !== null ? user.membership : void 0;
			return {
				planName: typeof membership === "object" && membership !== null ? str(membership.level) : void 0,
				windows
			};
		}
	}
};
/**
* GLM Coding Plan quota windows, keyed by the provider's own `unit` code
* rather than by row position so an added or reordered limit cannot shift a
* window's meaning: 3 = the rolling 5-hour window, 6 = the weekly window,
* 5 = the monthly one. Two row kinds carry quota — `TOKENS_LIMIT` (token
* plans) and `CREDIT_LIMIT` (credit plans, whose exact ratio is
* `currentValue` / `usage`) — while `TIME_LIMIT` is the MCP request cap and
* is not a plan window at all. Auth is the RAW key without a Bearer prefix.
*/
const GLM_UNIT_KEYS = {
	3: "5h",
	5: "month",
	6: "week"
};
/** Percent from a credit row's exact ratio, else the provider's own percentage. */
function glmCreditPercent(row) {
	const used = toNum(row.currentValue);
	const limit = toNum(row.usage);
	if (used !== void 0 && limit !== void 0 && limit > 0) return clampPercent(used / limit * 100);
	const percentage = toNum(row.percentage);
	return percentage === void 0 ? void 0 : clampPercent(percentage);
}
function glmPlan(host, ids) {
	return {
		ids,
		displayName: "GLM Coding Plan",
		plan: {
			build: ({ apiKey }) => ({
				url: `https://${host}/api/monitor/usage/quota/limit`,
				headers: {
					authorization: apiKey,
					"accept-language": "en-US,en"
				}
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const root = body;
				if (root.success !== true) return void 0;
				const data = root.data;
				if (typeof data !== "object" || data === null) return void 0;
				const limits = data.limits;
				if (!Array.isArray(limits)) return void 0;
				const windows = [];
				for (const entry of limits) {
					if (typeof entry !== "object" || entry === null) continue;
					const row = entry;
					const kind = str(row.type);
					if (kind === "TIME_LIMIT") continue;
					const key = GLM_UNIT_KEYS[toNum(row.unit) ?? NaN];
					if (key === void 0) continue;
					if (kind !== "TOKENS_LIMIT" && kind !== "CREDIT_LIMIT") continue;
					windows.push({
						key,
						percent: kind === "CREDIT_LIMIT" ? glmCreditPercent(row) : (() => {
							const percentage = toNum(row.percentage);
							return percentage === void 0 ? void 0 : clampPercent(percentage);
						})(),
						resetsAt: toIso(row.nextResetTime)
					});
				}
				if (windows.length === 0) return void 0;
				return {
					planName: str(data.level),
					windows
				};
			}
		}
	};
}
/** OpenCode Go quota: percent-only rolling/weekly/monthly windows. */
const OPENCODE_GO = {
	ids: ["opencode-go"],
	displayName: "OpenCode Go",
	plan: {
		build: ({ apiKey }) => ({
			url: "https://opencode.ai/zen/go/v1/usage",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const usage = body.usage;
			if (typeof usage !== "object" || usage === null) return void 0;
			const windows = [];
			for (const [field, key] of [
				["rolling", "5h"],
				["weekly", "week"],
				["monthly", "month"]
			]) {
				const entry = usage[field];
				if (typeof entry !== "object" || entry === null) continue;
				const row = entry;
				const percent = toNum(row.percent);
				windows.push({
					key,
					percent: percent === void 0 ? void 0 : Math.max(0, Math.min(100, percent)),
					resetsAt: percent === 0 ? void 0 : toIso(row.resetsAt)
				});
			}
			if (windows.length === 0) return void 0;
			return { windows };
		}
	}
};
/** MiniMax coding-plan remains: remaining-percent semantics, `general` model entry. */
function minimaxPlan(host, ids) {
	return {
		ids,
		displayName: "MiniMax Coding Plan",
		plan: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/api/openplatform/coding_plan/remains`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const remains = body.model_remains;
				if (!Array.isArray(remains)) return void 0;
				const general = remains.find((entry) => typeof entry === "object" && entry !== null && entry.model_name === "general");
				if (typeof general !== "object" || general === null) return void 0;
				const row = general;
				const windows = [];
				const intervalRemaining = toNum(row.current_interval_remaining_percent);
				if (intervalRemaining !== void 0) windows.push({
					key: "5h",
					percent: Math.max(0, Math.min(100, 100 - intervalRemaining)),
					resetsAt: toIso(row.end_time)
				});
				if (row.current_weekly_status === 1) {
					const weeklyRemaining = toNum(row.current_weekly_remaining_percent);
					if (weeklyRemaining !== void 0) windows.push({
						key: "week",
						percent: Math.max(0, Math.min(100, 100 - weeklyRemaining)),
						resetsAt: toIso(row.weekly_end_time)
					});
				}
				if (windows.length === 0) return void 0;
				return { windows };
			}
		}
	};
}
const OPENROUTER = {
	ids: ["openrouter"],
	displayName: "OpenRouter",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://openrouter.ai/api/v1/credits",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const data = body.data;
			if (typeof data !== "object" || data === null) return void 0;
			const credits = toNum(data.total_credits);
			const used = toNum(data.total_usage) ?? 0;
			if (credits === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(credits - used)
			};
		}
	}
};
function siliconFlow(host, ids, currency) {
	return {
		ids,
		displayName: "SiliconFlow",
		balance: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/user/info`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const data = body.data;
				if (typeof data !== "object" || data === null) return void 0;
				const total = str(data.totalBalance);
				if (total === void 0) return void 0;
				return {
					currency,
					totalBalance: total
				};
			}
		}
	};
}
const ZENMUX = {
	ids: ["zenmux"],
	displayName: "ZenMux",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://zenmux.ai/api/v1/management/payg/balance",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const data = body.data;
			if (typeof data !== "object" || data === null) return void 0;
			const credits = toNum(data.total_credits);
			if (credits === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(credits)
			};
		}
	}
};
/**
* OpenAI Codex (ChatGPT subscription) quota over the OAuth access token the
* pi-ai grant stores — the one plan adapter whose credential is an OAuth
* token rather than an API key. A 401 here means the stored access token has
* expired; it refreshes when the harness next runs a Codex request, so the
* error line tells the user to use Codex once and refresh.
*/
const OPENAI_CODEX = {
	ids: ["openai-codex"],
	displayName: "Codex (ChatGPT 订阅)",
	plan: {
		build: ({ apiKey, accountId }) => ({
			url: "https://chatgpt.com/backend-api/wham/usage",
			headers: {
				authorization: `Bearer ${apiKey}`,
				"user-agent": "codex-cli",
				accept: "application/json",
				...accountId !== void 0 ? { "chatgpt-account-id": accountId } : {}
			}
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const rateLimit = body.rate_limit;
			if (typeof rateLimit !== "object" || rateLimit === null) return void 0;
			const windows = [];
			const rows = rateLimit.primary_window !== void 0 || rateLimit.secondary_window !== void 0 ? [rateLimit.primary_window, rateLimit.secondary_window] : [];
			for (const entry of rows) {
				if (typeof entry !== "object" || entry === null) continue;
				const row = entry;
				const percent = toNum(row.used_percent);
				if (percent === void 0) continue;
				const seconds = toNum(row.limit_window_seconds);
				windows.push({
					key: codexWindowKey(seconds),
					percent: Math.max(0, Math.min(100, percent)),
					resetsAt: toIso(row.reset_at)
				});
			}
			if (windows.length === 0) return void 0;
			return { windows };
		}
	}
};
/** Map a Codex window length in seconds onto the shared window key vocabulary. */
function codexWindowKey(seconds) {
	if (seconds === void 0) return "window";
	if (seconds === 18e3) return "5h";
	if (seconds === 604800) return "week";
	if (seconds === 2592e3) return "month";
	const hours = seconds / 3600;
	return hours >= 24 ? `${Math.round(hours / 24)}_day` : `${Math.round(hours)}_hour`;
}
/**
* The adapter registry, in no particular order. Route keys come from the
* pi-ai provider catalog plus the routes this deployment observed in user
* configuration (`zenmux`).
*/
const PROVIDER_ADAPTERS = [
	DEEPSEEK,
	moonshotBalance("api.moonshot.cn", "CNY", ["moonshotai-cn"]),
	moonshotBalance("api.moonshot.ai", "USD", ["moonshotai"]),
	KIMI_CODING,
	glmPlan("open.bigmodel.cn", ["zai-coding-cn"]),
	glmPlan("api.z.ai", ["zai", "zai-coding"]),
	OPENCODE_GO,
	minimaxPlan("api.minimaxi.com", ["minimax-cn"]),
	minimaxPlan("api.minimax.io", ["minimax"]),
	OPENAI_CODEX,
	OPENROUTER,
	siliconFlow("api.siliconflow.cn", ["siliconflow", "siliconflow-cn"], "CNY"),
	siliconFlow("api.siliconflow.com", ["siliconflow-intl"], "USD"),
	ZENMUX
];
/** Find the adapter serving a provider route key, if any. */
function adapterFor(provider) {
	return PROVIDER_ADAPTERS.find((adapter) => adapter.ids.includes(provider));
}
/** Origin of a configured base URL, or undefined when it cannot be parsed. */
function originOf(baseURL) {
	if (baseURL === void 0 || baseURL.trim() === "") return void 0;
	try {
		return new URL(baseURL).origin;
	} catch {
		return;
	}
}
/**
* Whether an adapter's balance endpoint reports THIS route's account.
*
* Some adapter families share one route key across providers that merely
* speak the same API: `deepseek` is both the official DeepSeek catalog entry
* and a common id for an OpenAI-compatible reseller (Alibaba Bailian, ...)
* pointed at another host by the profile's `baseURL`. The balance endpoint is
* per ORIGIN, not per route key, so probing the official endpoint for a
* reseller profile reports the official account's money under the reseller's
* name (issue #1688). An adapter published with a fixed `origin` therefore
* only applies to a route whose configured base URL is that origin, or to a
* route that pins no base URL at all (the catalog alias of the official
* route, which resolves the family's own credential).
*
* @param adapter - the matched adapter.
* @param baseURL - the route's configured base URL (pi-ai profile), if any.
* @returns true when the adapter may probe its balance endpoint for the route.
*/
function balanceAppliesToRoute(adapter, baseURL) {
	const expected = adapter.balance?.origin;
	if (expected === void 0) return true;
	const configured = originOf(baseURL);
	if (configured === void 0) return true;
	return configured === expected;
}
/**
* Whether a provider route belongs to the official DeepSeek family: the only
* family with a spend price book and a settings-section-owned env credential
* (llm-deepseek) rather than a pi-ai profile. Drives the fold-time cost
* stamping, the client fold-time spend estimate, and the whale-yuan bank.
*
* Family membership is wider than the probe directory. The account route
* (deepseek-account) bills the same account but authenticates with the account
* token, so it prices and mints while `adapterFor()` still returns undefined
* for it and no probe or env-credential fallback can reach it. Every caller of
* this predicate is an accounting decision; the credential and probing
* decisions read `adapterFor()` instead, so the two never widen together
* (issue #1772).
*/
function isDeepSeekProviderRoute(provider) {
	if (adapterFor(provider) === DEEPSEEK) return true;
	return DEEPSEEK.familyOnlyIds?.includes(provider) === true;
}
/**
* Whether one ledger model id denotes a DeepSeek model, whichever route served
* it. Consumption of a DeepSeek model through an aggregator or a relay is still
* DeepSeek consumption, so the Token Bank's price-book scenario counts it — the
* route-family predicate alone only ever sees the official account.
*
* The match is deliberately narrow: `deepseek` must appear in the id. Every
* real naming observed in this machine's ledger keeps the vendor token —
* `deepseek-v4.1-flash` (bailian), `loomy/DeepSeek-V4.1-Flash` (a relay),
* `our-free-model/deepseek-ai/deepseek-v4.1-flash` — and the official routes log
* `deepseek-flash`.
*/
function isDeepSeekModelId(model) {
	return /deepseek/i.test(model);
}
/**
* Whether one ledger row (route + model) counts as DeepSeek consumption. The
* route clause keeps an official route honest even if it ever logged a model id
* without the vendor token; the model clause is what reaches relay and
* aggregator traffic.
*/
function countsAsDeepSeekUsage(provider, model) {
	return isDeepSeekProviderRoute(provider) || isDeepSeekModelId(model);
}
/**
* Best-effort human message from a provider error body, for the per-provider
* error line. Never throws; truncated to one short sentence.
*/
function providerErrorMessage(status, body) {
	let message;
	if (typeof body === "object" && body !== null) {
		const root = body;
		const nested = typeof root.error === "object" && root.error !== null ? root.error : void 0;
		message = str(root.message) ?? str(root.msg) ?? (nested !== void 0 ? str(nested.message) : void 0);
	}
	return `HTTP ${status}${message === void 0 ? "" : `: ${message.slice(0, 120)}`}`;
}
//#endregion
//#region src/core/provider-routes.ts
/**
* Alias folding for the enumerated provider routes. Kept in core because the
* rule is pure — the host enumerates routes and this decides which of two
* routes serving one adapter family survives.
* @module @fish-under-sea/dsh-usage/core/provider-routes
*/
/**
* Drop dormant catalog aliases that shadow a live route of the same adapter
* family. The pi-ai catalog ships route keys the runtime serves nothing on
* until a profile declares them: for DeepSeek the catalog entry `deepseek`
* sits beside the llm-deepseek runtime route `deepseek-official`, and both
* resolve the same credential (the family's `apiKeyEnv` fallback), so probing
* and rendering both turns one account into two identical balance rows.
*
* A family keeps every live route it has — two configured profiles are two
* real accounts, not aliases. A route with no adapter, or one whose family
* has no live route at all, is returned untouched.
*/
function foldAliasRoutes(routes) {
	return routes.filter((route) => {
		if (route.live) return true;
		const family = adapterFor(route.id);
		if (family === void 0) return true;
		return !routes.some((other) => other.live && adapterFor(other.id) === family);
	});
}
//#endregion
//#region src/core/holidays.ts
/**
* Chinese public-holiday dates, Beijing calendar days, as `YYYY-MM-DD`.
*
* The DeepSeek peak rule bills a public holiday off-peak in full, and the
* State Council publishes these dates per year, so they cannot be derived
* from a rule. This module is that data; `pricing.ts` keeps the arithmetic.
*
* Adjusted workdays are deliberately absent: the provider counts the
* calendar day, so an adjusted Saturday or Sunday is off-peak exactly like
* any other weekend and listing it would price it as peak.
*
* Source: the yearly schedules in bastengao/chinese-holidays-node
* (`data/<year>.json`, MIT). Only the `holiday` entries are taken; that
* package's runtime code (which fetches over the network) and its
* dependencies are not vendored.
*
* Coverage ends at the newest year below. A year with no entry is priced as
* if it had no holidays, which is the documented default of
* {@link PublicHolidayCalendar} in `pricing.ts`.
* @module @fish-under-sea/dsh-usage/core/holidays
*/
/** Public-holiday dates keyed by Beijing calendar year. */
const CHINESE_PUBLIC_HOLIDAYS = {
	"2020": [
		"2020-01-24",
		"2020-01-25",
		"2020-01-26",
		"2020-01-27",
		"2020-01-28",
		"2020-01-29",
		"2020-01-30",
		"2020-04-04",
		"2020-04-05",
		"2020-04-06",
		"2020-05-01",
		"2020-05-02",
		"2020-05-03",
		"2020-05-04",
		"2020-05-05",
		"2020-06-25",
		"2020-06-26",
		"2020-06-27",
		"2020-10-01",
		"2020-10-02",
		"2020-10-03",
		"2020-10-04",
		"2020-10-05",
		"2020-10-06",
		"2020-10-07",
		"2020-10-08"
	],
	"2021": [
		"2021-01-01",
		"2021-01-02",
		"2021-01-03",
		"2021-02-11",
		"2021-02-12",
		"2021-02-13",
		"2021-02-14",
		"2021-02-15",
		"2021-02-16",
		"2021-02-17",
		"2021-04-03",
		"2021-04-04",
		"2021-04-05",
		"2021-05-01",
		"2021-05-02",
		"2021-05-03",
		"2021-05-04",
		"2021-05-05",
		"2021-06-12",
		"2021-06-13",
		"2021-06-14",
		"2021-09-19",
		"2021-09-20",
		"2021-09-21",
		"2021-10-01",
		"2021-10-02",
		"2021-10-03",
		"2021-10-04",
		"2021-10-05",
		"2021-10-06",
		"2021-10-07"
	],
	"2022": [
		"2022-01-01",
		"2022-01-02",
		"2022-01-03",
		"2022-01-31",
		"2022-02-01",
		"2022-02-02",
		"2022-02-03",
		"2022-02-04",
		"2022-02-05",
		"2022-02-06",
		"2022-04-03",
		"2022-04-04",
		"2022-04-05",
		"2022-04-30",
		"2022-05-01",
		"2022-05-02",
		"2022-05-03",
		"2022-05-04",
		"2022-06-03",
		"2022-06-04",
		"2022-06-05",
		"2022-09-10",
		"2022-09-11",
		"2022-09-12",
		"2022-10-01",
		"2022-10-02",
		"2022-10-03",
		"2022-10-04",
		"2022-10-05",
		"2022-10-06",
		"2022-10-07"
	],
	"2023": [
		"2022-12-31",
		"2023-01-01",
		"2023-01-02",
		"2023-01-21",
		"2023-01-22",
		"2023-01-23",
		"2023-01-24",
		"2023-01-25",
		"2023-01-26",
		"2023-01-27",
		"2023-04-29",
		"2023-04-30",
		"2023-05-01",
		"2023-05-02",
		"2023-05-03",
		"2023-06-22",
		"2023-06-23",
		"2023-06-24",
		"2023-09-29",
		"2023-09-30",
		"2023-10-01",
		"2023-10-02",
		"2023-10-03",
		"2023-10-04",
		"2023-10-05",
		"2023-10-06"
	],
	"2024": [
		"2023-12-30",
		"2023-12-31",
		"2024-01-01",
		"2024-02-10",
		"2024-02-11",
		"2024-02-12",
		"2024-02-13",
		"2024-02-14",
		"2024-02-15",
		"2024-02-16",
		"2024-02-17",
		"2024-04-04",
		"2024-04-05",
		"2024-04-06",
		"2024-05-01",
		"2024-05-02",
		"2024-05-03",
		"2024-05-04",
		"2024-05-05",
		"2024-06-08",
		"2024-06-09",
		"2024-06-10",
		"2024-09-15",
		"2024-09-16",
		"2024-09-17",
		"2024-10-01",
		"2024-10-02",
		"2024-10-03",
		"2024-10-04",
		"2024-10-05",
		"2024-10-06",
		"2024-10-07"
	],
	"2025": [
		"2025-01-28",
		"2025-01-29",
		"2025-01-30",
		"2025-01-31",
		"2025-02-01",
		"2025-02-02",
		"2025-02-03",
		"2025-02-04",
		"2025-04-04",
		"2025-04-05",
		"2025-04-06",
		"2025-05-01",
		"2025-05-02",
		"2025-05-03",
		"2025-05-04",
		"2025-05-05",
		"2025-05-31",
		"2025-06-01",
		"2025-06-02",
		"2025-10-01",
		"2025-10-02",
		"2025-10-03",
		"2025-10-04",
		"2025-10-05",
		"2025-10-06",
		"2025-10-07",
		"2025-10-08"
	],
	"2026": [
		"2026-01-01",
		"2026-01-02",
		"2026-01-03",
		"2026-02-15",
		"2026-02-16",
		"2026-02-17",
		"2026-02-18",
		"2026-02-19",
		"2026-02-20",
		"2026-02-21",
		"2026-02-22",
		"2026-02-23",
		"2026-04-04",
		"2026-04-05",
		"2026-04-06",
		"2026-05-01",
		"2026-05-02",
		"2026-05-03",
		"2026-05-04",
		"2026-05-05",
		"2026-06-19",
		"2026-06-20",
		"2026-06-21",
		"2026-09-25",
		"2026-09-26",
		"2026-09-27",
		"2026-10-01",
		"2026-10-02",
		"2026-10-03",
		"2026-10-04",
		"2026-10-05",
		"2026-10-06",
		"2026-10-07"
	]
};
//#endregion
//#region src/core/pricing.ts
/** The published peak windows: weekday 09:00-12:00 and 14:00-18:00. */
const PEAK_WINDOWS = [{
	from: 540,
	to: 720
}, {
	from: 840,
	to: 1080
}];
/** Beijing is UTC+8 year-round (no DST), so a fixed shift is exact. */
const BEIJING_UTC_OFFSET_MS = 8 * 36e5;
/** deepseek-flash (DeepSeek-V4.1-Flash), including the retired flash-class ids it now serves. */
const FLASH_PRICE = {
	cacheHit: {
		offPeak: .02,
		peak: .04
	},
	inputMiss: {
		offPeak: 1,
		peak: 2
	},
	output: {
		offPeak: 4,
		peak: 8
	}
};
/** deepseek-v4-pro (DeepSeek-V4-Pro-0813); superseded by the flash row at the retirement instant. */
const PRO_PRICE = {
	cacheHit: {
		offPeak: .15,
		peak: .3
	},
	inputMiss: {
		offPeak: 4.5,
		peak: 9
	},
	output: {
		offPeak: 13.5,
		peak: 27
	}
};
/**
* The instant DeepSeek starts serving `deepseek-v4-pro` requests from
* V4.1-Flash and billing the flash row: 2026-09-14 12:00 Beijing (UTC+8).
* Drop the pro row's time fence once V4.1 Pro ships with a published row.
*/
const V4_PRO_FOLDED_INTO_FLASH_AT_MS = Date.UTC(2026, 8, 14, 4, 0);
function withinWindow(minuteOfDay) {
	return PEAK_WINDOWS.find((window) => minuteOfDay >= window.from && minuteOfDay < window.to);
}
/**
* The default calendar: the published Chinese public-holiday table, so a holiday
* weekday prices off-peak instead of over-reporting at the peak rate. A year the
* table does not cover holds no dates and falls back to peak on weekdays, which
* is the safe direction to be wrong in: the estimate reads high rather than low.
*/
const CN_PUBLIC_HOLIDAYS = { isPublicHoliday: (date) => {
	const year = date.slice(0, 4);
	if (Number(year) > 2026) return false;
	return CHINESE_PUBLIC_HOLIDAYS[year]?.includes(date) ?? false;
} };
/** The Beijing-time `YYYY-MM-DD` calendar day of `ms` (UTC+8 has no DST, so the shift is exact). */
function beijingDate(ms) {
	const shifted = new Date(ms + BEIJING_UTC_OFFSET_MS);
	const month = `${shifted.getUTCMonth() + 1}`.padStart(2, "0");
	const day = `${shifted.getUTCDate()}`.padStart(2, "0");
	return `${shifted.getUTCFullYear()}-${month}-${day}`;
}
/**
* Whether `ms` falls on a peak-eligible Beijing day: Monday-Friday that is
* not a public holiday. A Saturday or Sunday is never eligible, including on
* an adjusted workday — the provider counts the calendar day, not the
* working schedule.
*/
function isPeakDay(ms, calendar) {
	const weekday = new Date(ms + BEIJING_UTC_OFFSET_MS).getUTCDay();
	if (weekday < 1 || weekday > 5) return false;
	return !calendar.isPublicHoliday(beijingDate(ms));
}
/**
* The DeepSeek billing period at `ms`, plus when it next flips. The clock is
* Beijing time regardless of the host timezone (UTC+8 has no DST, so a fixed
* shift is exact). `boundaryMs` is the instant the current period ends — the
* window's close while peaking, the next window's open otherwise.
*/
function deepseekPeriodAt(ms, calendar = CN_PUBLIC_HOLIDAYS) {
	const shifted = new Date(ms + BEIJING_UTC_OFFSET_MS);
	const minuteOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
	const current = isPeakDay(ms, calendar) ? withinWindow(minuteOfDay) : void 0;
	if (current !== void 0) return {
		peak: true,
		boundaryMs: ms + (current.to - minuteOfDay) * 6e4 - shifted.getUTCSeconds() * 1e3 - shifted.getUTCMilliseconds()
	};
	for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
		const dayStartMs = ms + dayOffset * 864e5;
		if (!isPeakDay(dayStartMs, calendar)) continue;
		const day = new Date(dayStartMs + BEIJING_UTC_OFFSET_MS);
		const realDayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - BEIJING_UTC_OFFSET_MS;
		for (const window of PEAK_WINDOWS) {
			if (dayOffset === 0 && window.from <= minuteOfDay) continue;
			return {
				peak: false,
				boundaryMs: realDayStart + window.from * 6e4
			};
		}
	}
	return {
		peak: false,
		boundaryMs: ms + 864e5
	};
}
/** The price row for a model id at `atMs`; unknown ids take the flash-class row (documented estimate). */
function priceFor(model, atMs) {
	return model.includes("v4-pro") && atMs < V4_PRO_FOLDED_INTO_FLASH_AT_MS ? PRO_PRICE : FLASH_PRICE;
}
/**
* Estimate one call's DeepSeek spend in CNY from its token totals, priced in
* the billing period at `atMs`. Uncatalogued model ids take the flash-class
* row; ids from other providers never reach this function (the service gates
* by route family). Rounded to micro-CNY so the ledger stays readable.
*/
function deepseekModelSpend(model, totals, atMs, calendar = CN_PUBLIC_HOLIDAYS) {
	const price = priceFor(model, atMs);
	const column = deepseekPeriodAt(atMs, calendar).peak ? "peak" : "offPeak";
	const spend = (totals.cacheReadTokens * price.cacheHit[column] + (totals.inputTokens + totals.cacheWriteTokens) * price.inputMiss[column] + totals.outputTokens * price.output[column]) / 1e6;
	return Math.round(spend * 1e6) / 1e6;
}
//#endregion
//#region src/core/types.ts
/** A zeroed totals bucket. */
function emptyTotals() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		reasoningTokens: 0,
		calls: 0,
		cost: 0
	};
}
/** Add `right` into `left` in place. */
function addTotals(left, right) {
	left.inputTokens += right.inputTokens;
	left.outputTokens += right.outputTokens;
	left.cacheReadTokens += right.cacheReadTokens;
	left.cacheWriteTokens += right.cacheWriteTokens;
	left.reasoningTokens += right.reasoningTokens;
	left.calls += right.calls;
	left.cost += right.cost;
	return left;
}
//#endregion
//#region src/core/ledger.ts
/**
* The usage ledger: a pure fold from session usage facts into a per-day,
* per-provider, per-model totals document, plus its JSON serialization.
* Host-side state lives only in the document; the service owns persistence.
* @module @fish-under-sea/dsh-usage/core/ledger
*/
/** Local-date key (`YYYY-MM-DD`) for an epoch ms timestamp. */
function localDateKey(ms) {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
/**
* Whether `key` is a real local-date key (`YYYY-MM-DD`). The shape check is
* round-tripped: an impossible date (9999-99-99) parses to NaN and a rollover
* (2026-02-30) lands on another day, so both would otherwise fold into a bogus,
* never-pruned bucket. Shared by the persisted-document reader and the day
* route's query gate.
*/
function isLedgerDateKey(key) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
	const atMs = (/* @__PURE__ */ new Date(key + "T12:00:00")).getTime();
	return Number.isFinite(atMs) && localDateKey(atMs) === key;
}
/** An empty ledger document. */
function createLedgerDocument() {
	return {
		version: 1,
		days: {}
	};
}
/**
* Bucket keys come from untrusted directions (persisted JSON, provider and
* model ids out of session events), so they must never collide with
* `Object.prototype` plumbing: assigning `day['__proto__']` or reading
* `day['constructor']` would pollute every object in the host process.
*/
function isSafeBucketKey(key) {
	return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}
/**
* Fold one usage report into the ledger in place. `provider` is the route key
* and `model` the provider-owned model id the step ran under. Reports keyed
* by prototype-plumbing names are dropped.
*/
function foldUsage(doc, atMs, provider, model, usage) {
	if (!isSafeBucketKey(provider) || !isSafeBucketKey(model)) return;
	if (usage.calls <= 0 && usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens <= 0) return;
	const dayKey = localDateKey(atMs);
	const day = doc.days[dayKey] ?? {};
	const models = day[provider] ?? {};
	const totals = models[model] ?? emptyTotals();
	addTotals(totals, usage);
	models[model] = totals;
	day[provider] = models;
	doc.days[dayKey] = day;
}
/** Total tokens of a bucket (billed input + output; reasoning is inside output). */
function totalTokens(totals) {
	return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens;
}
/**
* Aggregate whole per-day maps (each `provider -> model -> totals`) into the
* per-provider/per-model summary the overview serves for one day or a range:
* disjoint bucket sums per provider, per-model rows heaviest first, and the
* grand total. Pure: reads its inputs, allocates fresh buckets.
*/
function summarizeDays(days) {
	const merged = /* @__PURE__ */ new Map();
	const deepseek = emptyTotals();
	for (const day of days) for (const [provider, models] of Object.entries(day)) {
		if (!isSafeBucketKey(provider) || typeof models !== "object" || models === null) continue;
		let modelMap = merged.get(provider);
		if (modelMap === void 0) {
			modelMap = /* @__PURE__ */ new Map();
			merged.set(provider, modelMap);
		}
		for (const [model, totals] of Object.entries(models)) {
			if (typeof totals !== "object" || totals === null) continue;
			const bucket = modelMap.get(model) ?? emptyTotals();
			addTotals(bucket, totals);
			modelMap.set(model, bucket);
			if (countsAsDeepSeekUsage(provider, model)) addTotals(deepseek, totals);
		}
	}
	const providers = [];
	const totals = emptyTotals();
	for (const [provider, modelMap] of merged) {
		const providerTotals = emptyTotals();
		const modelRows = [...modelMap].map(([model, modelTotals]) => ({
			model,
			totals: modelTotals
		}));
		for (const row of modelRows) addTotals(providerTotals, row.totals);
		modelRows.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals));
		providers.push({
			provider,
			totals: providerTotals,
			models: modelRows.slice(0, 12)
		});
	}
	providers.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals));
	for (const row of providers) addTotals(totals, row.totals);
	return {
		totals,
		providers,
		deepseek
	};
}
/** All local-date keys in the ledger, ascending. */
function ledgerDayKeys(doc) {
	return Object.keys(doc.days).sort();
}
/**
* Drop every day older than `retainDays` local days before `todayKey`, in
* place. Returns the number of pruned days.
*/
function pruneLedger(doc, todayKey, retainDays) {
	const cutoff = /* @__PURE__ */ new Date(todayKey + "T00:00:00");
	cutoff.setDate(cutoff.getDate() - retainDays);
	const cutoffKey = localDateKey(cutoff.getTime());
	let pruned = 0;
	for (const key of Object.keys(doc.days)) if (key < cutoffKey) {
		delete doc.days[key];
		pruned += 1;
	}
	return pruned;
}
function reviveTotals(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const source = value;
	const num = (key) => typeof source[key] === "number" && Number.isFinite(source[key]) ? source[key] : 0;
	return {
		inputTokens: num("inputTokens"),
		outputTokens: num("outputTokens"),
		cacheReadTokens: num("cacheReadTokens"),
		cacheWriteTokens: num("cacheWriteTokens"),
		reasoningTokens: num("reasoningTokens"),
		calls: num("calls"),
		cost: num("cost")
	};
}
/**
* Parse a ledger document from untrusted JSON: unknown shapes resolve to an
* empty document, malformed entries are dropped, numbers are coerced to
* finite values. Never throws.
*/
function deserializeLedger(value) {
	const doc = createLedgerDocument();
	if (typeof value !== "object" || value === null) return doc;
	const days = value.days;
	if (typeof days !== "object" || days === null) return doc;
	for (const [dateKey, providers] of Object.entries(days)) {
		if (!isLedgerDateKey(dateKey) || typeof providers !== "object" || providers === null) continue;
		const atMs = (/* @__PURE__ */ new Date(dateKey + "T12:00:00")).getTime();
		for (const [provider, models] of Object.entries(providers)) {
			if (typeof models !== "object" || models === null) continue;
			for (const [model, totals] of Object.entries(models)) {
				const revived = reviveTotals(totals);
				if (revived !== void 0) foldUsage(doc, atMs, provider, model, revived);
			}
		}
	}
	return doc;
}
//#endregion
//#region src/host/usage-service.ts
/**
* The dsh-usage host service: folds live session usage into the persistent
* ledger, probes each configured provider's balance/coding-plan endpoint on
* a poll cycle, and serves the current provider's strip-ready view inside
* the overview document. Secrets stay in the host process; the browser only
* ever sees the overview document.
* @module @fish-under-sea/dsh-usage/host/usage-service
*/
/** Probe timeout per HTTP call. */
const PROBE_TIMEOUT_MS = 1e4;
/** Ledger flush debounce. */
const FLUSH_DEBOUNCE_MS = 3e3;
/** Best-effort typed service read: absent services resolve to undefined at runtime. */
function service(ctx, name) {
	try {
		return ctx.get(name);
	} catch {
		return;
	}
}
/**
* Atomic JSON write through a unique temp file + fsync + rename. The temp
* name is per-call so two overlapping flushes can never interleave into one
* temp file, and the fsync closes the rename-lands-but-bytes-are-not-durable
* window.
*/
async function writeJsonAtomic(path, value) {
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
function unwrapVolatiles(value) {
	if (value === null || value === void 0) return value;
	if (typeof value === "object") {
		if (typeof value.get === "function") return unwrapVolatiles(value.get());
		if (Array.isArray(value)) return value.map(unwrapVolatiles);
		const result = {};
		for (const [k, v] of Object.entries(value)) result[k] = unwrapVolatiles(v);
		return result;
	}
	return value;
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function deepMerge(base, patch) {
	if (!isPlainObject(base) || !isPlainObject(patch)) return patch !== void 0 ? patch : base;
	const result = { ...base };
	for (const [key, value] of Object.entries(patch)) {
		if (value === void 0) continue;
		result[key] = isPlainObject(value) && isPlainObject(result[key]) ? deepMerge(result[key], value) : value;
	}
	return result;
}
/**
* Read a foreign settings namespace's resolved value (the llm adapter
* profiles, the agent default model). Resolves across pre-0.1.7 settings.get(),
* 0.1.7 SettingsForms.describe(), live loader entries, and configEditor.
* Unregistered namespaces read as undefined; nothing here throws into the poll loop.
*/
function readNamespace(ctx, ns) {
	try {
		const settings = service(ctx, "settings");
		if (settings !== void 0) {
			if (typeof settings.get === "function") {
				const value = settings.get(ns);
				if (value !== void 0) return unwrapVolatiles(value);
			}
			if (typeof settings.describe === "function") {
				const descriptors = settings.describe({ redactSecrets: false });
				if (Array.isArray(descriptors)) {
					const match = descriptors.find((d) => d.ns === ns || ns === "llm-pi-ai" && (d.ns === "llm" || isPlainObject(d.value?.providers)) || ns === "llm-deepseek" && (d.ns === "llm-deepseek" || d.ns === "llm-deepseek-api-key"));
					if (match !== void 0 && match.value !== void 0) return unwrapVolatiles(match.value);
				}
			}
		}
		const loader = ctx.root?.loader ?? ctx.loader;
		if (loader !== void 0 && typeof loader.entries === "function") for (const entry of loader.entries()) {
			const id = entry.options?.id;
			const name = entry.options?.name;
			if (id === ns || name === `@deepseek-ai/dsh-${ns}` || name?.endsWith(`/${ns}`) || ns === "llm-pi-ai" && (id === "llm" || name === "@deepseek-ai/dsh-llm-pi-ai") || ns === "llm-deepseek" && (id === "llm-deepseek-api-key" || name === "@deepseek-ai/dsh-llm-deepseek-api-key")) {
				if (entry.fiber?.config !== void 0) return unwrapVolatiles(entry.fiber.config);
			}
		}
		const editor = service(ctx, "configEditor");
		if (editor !== void 0 && typeof editor.configuration === "function") {
			const match = editor.configuration().find((r) => {
				const id = r.entry.options.id;
				const name = r.entry.options.name;
				return id === ns || name === `@deepseek-ai/dsh-${ns}` || name?.endsWith(`/${ns}`) || ns === "llm-pi-ai" && (id === "llm" || name === "@deepseek-ai/dsh-llm-pi-ai") || ns === "llm-deepseek" && (id === "llm-deepseek-api-key" || name === "@deepseek-ai/dsh-llm-deepseek-api-key");
			});
			if (match !== void 0) {
				if (match.entry.fiber?.config !== void 0) return unwrapVolatiles(match.entry.fiber.config);
				return unwrapVolatiles(deepMerge(match.inherited, match.override));
			}
		}
	} catch {
		return;
	}
}
var UsageService = class {
	ctx;
	options;
	persistDir;
	ledgerPath;
	snapshotsPath;
	ledger = createLedgerDocument();
	snapshots = /* @__PURE__ */ new Map();
	/** The official DeepSeek family's real-spend watch (see SpendWatch). */
	spendWatch;
	/** Per-live-session route attribution (WeakMap: disposed sessions age out). */
	sessionRoutes = /* @__PURE__ */ new WeakMap();
	/** The most recent route seen this boot; the sidebar strip and the header highlight follow it. */
	current = { source: "default" };
	sessionListenerDisposer;
	pollTimer;
	flushTimer;
	pollInFlight = false;
	/** The running poll cycle; manual refresh joins it instead of no-oping. */
	pollPromise;
	/** Serialized ledger flushes: overlapping debounce/stop flushes queue, never interleave. */
	flushChain = Promise.resolve();
	/** True once loadPersisted finished; nothing may overwrite the files before that. */
	loaded = false;
	disposed = false;
	/** Last prune guard: once per local day, and whenever retention shrinks. */
	lastPrune;
	constructor(ctx, options) {
		this.ctx = ctx;
		this.options = options;
		this.persistDir = join(dshHome(), "dsh-usage");
		this.ledgerPath = join(this.persistDir, "usage-ledger.json");
		this.snapshotsPath = join(this.persistDir, "provider-snapshots.json");
	}
	/** Start the listeners, load persisted state, and arm the first poll. */
	start() {
		this.sessionListenerDisposer = this.ctx.on("session/event", (session, event) => this.onSessionEvent(session, event));
		this.loadPersisted();
		this.rearmPoll(2e3);
	}
	/**
	* Stop timers and flush pending ledger writes. The returned promise
	* resolves after the final flush lands, so a successor instance (the Host
	* reloads the profile row on a config change) can serialize its first load
	* behind it.
	*/
	stop() {
		this.disposed = true;
		if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
		if (this.flushTimer !== void 0) clearTimeout(this.flushTimer);
		this.sessionListenerDisposer?.();
		return this.flushLedger();
	}
	/** Re-apply options to this running instance; retention shrink prunes now. */
	applyOptions(options) {
		this.options = options;
		this.pruneIfNeeded();
	}
	/** Force one poll now (manual refresh route); joins an in-flight cycle. */
	async refresh() {
		await this.pollNow();
	}
	/** Assemble the overview document the browser section renders. */
	overview() {
		const todayKey = localDateKey(Date.now());
		const routes = this.listProviderRoutes();
		const providers = [];
		for (const route of routes) {
			const adapter = adapterFor(route.id);
			const snapshot = this.snapshots.get(route.id);
			const error = snapshot?.balanceError ?? snapshot?.planError;
			providers.push({
				provider: route.id,
				displayName: route.displayName || adapter?.displayName || route.id,
				credential: snapshot?.credential ?? "none",
				supported: adapter !== void 0 && (adapter.balance !== void 0 || adapter.plan !== void 0),
				...adapter?.balance !== void 0 && balanceAppliesToRoute(adapter, this.routeBaseUrl(route.id)) ? { balanceSupported: true } : {},
				...adapter?.balance !== void 0 && !balanceAppliesToRoute(adapter, this.routeBaseUrl(route.id)) ? { balanceSupported: false } : {},
				...adapter?.plan !== void 0 ? { planSupported: true } : {},
				...snapshot?.balance !== void 0 ? { balance: snapshot.balance } : {},
				...snapshot?.plan !== void 0 ? { plan: snapshot.plan } : {},
				...error !== void 0 ? { error } : {},
				...snapshot?.updatedAt !== void 0 ? { updatedAt: snapshot.updatedAt } : {}
			});
		}
		providers.sort((a, b) => Number(b.supported) - Number(a.supported) || a.displayName.localeCompare(b.displayName));
		const allKeys = ledgerDayKeys(this.ledger);
		const days = allKeys.slice(-30);
		const range = summarizeDays(days.map((key) => this.ledger.days[key] ?? {}));
		const all = summarizeDays(allKeys.map((key) => this.ledger.days[key] ?? {}));
		return {
			updatedAt: Date.now(),
			providers,
			current: this.currentView(),
			usage: {
				today: this.daySummary(todayKey),
				days: days.map((date) => {
					return {
						date,
						totals: this.daySummary(date).totals
					};
				}),
				range: {
					from: days[0] ?? todayKey,
					to: days[days.length - 1] ?? todayKey,
					totals: range.totals,
					providers: range.providers,
					deepseek: range.deepseek
				},
				availableDays: allKeys,
				all: {
					from: allKeys[0] ?? todayKey,
					to: allKeys[allKeys.length - 1] ?? todayKey,
					totals: all.totals,
					providers: all.providers,
					deepseek: all.deepseek
				},
				...this.spendWatch !== void 0 && this.spendWatch.accruedCny > 0 ? { observedSpend: {
					cny: this.spendWatch.accruedCny,
					since: this.spendWatch.since
				} } : {}
			}
		};
	}
	/**
	* The strip-ready current-provider view: the resolved display name plus
	* today's ledger totals for the provider's adapter family (the route
	* itself when adapter-less). `today` is absent on a day without usage —
	* a strip about nothing is noise, not information.
	*/
	currentView() {
		const provider = this.current.provider;
		if (provider === void 0) return { ...this.current };
		let snapshot = this.snapshots.get(provider);
		if (snapshot === void 0) {
			const family = adapterFor(provider);
			if (family !== void 0) {
				for (const [id, candidate] of this.snapshots) if (adapterFor(id) === family) {
					snapshot = candidate;
					break;
				}
			}
		}
		const displayName = snapshot?.displayName ?? this.routeDisplayName(provider);
		const today = this.familyUsageToday(provider);
		return {
			...this.current,
			displayName,
			...today.calls > 0 && totalTokens(today) > 0 ? { today } : {}
		};
	}
	/**
	* One retained local day aggregated per provider and model, as the day
	* route serves it. A day the ledger never held — pruned by retention, or
	* simply without usage — reads as a zeroed day rather than an error, so a
	* picker selection that aged out degrades to "no usage" instead of a broken
	* panel. The route gates the key's shape before it gets here.
	*/
	day(dateKey) {
		return this.daySummary(dateKey);
	}
	/** One local day aggregated per provider. */
	daySummary(dateKey) {
		const { totals, providers, deepseek } = summarizeDays([this.ledger.days[dateKey] ?? {}]);
		return {
			date: dateKey,
			totals,
			providers,
			deepseek
		};
	}
	/**
	* Today's ledger totals for one provider's adapter family — the exact
	* route when adapter-less, the merged family otherwise, so aliased routes
	* of one account (the deepseek catalog id and its runtime alias) fold
	* together.
	*/
	familyUsageToday(provider) {
		const family = adapterFor(provider);
		let merged = emptyTotals();
		for (const row of this.daySummary(localDateKey(Date.now())).providers) if (family === void 0 ? row.provider === provider : adapterFor(row.provider) === family) merged = addTotals(merged, row.totals);
		return merged;
	}
	/**
	* Accrue the official DeepSeek family's real spend from observed CNY
	* balance decreases; a balance rise is a top-up and never counts. The
	* family's route ids can alias one account, so the watch follows the
	* largest balance seen this cycle and accrues only decreases of that
	* series — a failed probe keeps the stale balance and accrues nothing
	* until the next success reports the whole drop at once.
	*/
	accrueDeepSeekSpend() {
		let balanceCny;
		for (const [id, snapshot] of this.snapshots) {
			if (!isDeepSeekProviderRoute(id)) continue;
			const balance = snapshot.balance;
			if (balance === void 0 || balance.currency.toUpperCase() !== "CNY") continue;
			const value = Number(balance.totalBalance);
			if (!Number.isFinite(value)) continue;
			balanceCny = balanceCny === void 0 ? value : Math.max(balanceCny, value);
		}
		if (balanceCny === void 0) return;
		const watch = this.spendWatch ?? {
			accruedCny: 0,
			since: Date.now()
		};
		if (watch.lastBalanceCny !== void 0 && balanceCny < watch.lastBalanceCny) watch.accruedCny += watch.lastBalanceCny - balanceCny;
		watch.lastBalanceCny = balanceCny;
		this.spendWatch = watch;
	}
	/**
	* The display name for a route key: the LLM runtime's first, then the
	* adapter's, then the id itself — the snapshot may not exist for
	* adapter-less routes, yet the sidebar strip still needs a legible title.
	*/
	routeDisplayName(provider) {
		return this.listProviderRoutes().find((entry) => entry.id === provider)?.displayName || adapterFor(provider)?.displayName || provider;
	}
	onSessionEvent(session, event) {
		try {
			if (event.type === "request/header") {
				const config = event.data.header?.config;
				if (config?.provider !== void 0) {
					this.sessionRoutes.set(session, {
						provider: config.provider,
						model: config.model ?? ""
					});
					this.current = {
						provider: config.provider,
						model: config.model,
						source: "live"
					};
				}
			} else if (event.type === "request/context") {
				const data = event.data;
				if (data.provider !== void 0) {
					this.sessionRoutes.set(session, {
						provider: data.provider,
						model: data.model ?? ""
					});
					this.current = {
						provider: data.provider,
						model: data.model,
						source: "live"
					};
				}
			} else if (event.type === "assistant/message") {
				const usage = event.data.usage;
				if (usage === void 0) return;
				const route = this.sessionRoutes.get(session);
				if (route === void 0 || route.provider === "") return;
				foldUsage(this.ledger, Date.now(), route.provider, route.model || "unknown", this.totalsFrom(usage, route.provider, route.model || "unknown", Date.now()));
				this.scheduleFlush();
			}
		} catch {}
	}
	/**
	* Normalize a provider TokenUsage into the ledger bucket (one call). The
	* DeepSeek official family is priced at the fold instant (its billing
	* period is time-of-day); other families stay unpriced (cost 0).
	*/
	totalsFrom(usage, provider, model, atMs) {
		const totals = emptyTotals();
		totals.inputTokens = usage.inputTokens;
		totals.outputTokens = usage.outputTokens;
		totals.cacheReadTokens = usage.cacheReadTokens ?? 0;
		totals.cacheWriteTokens = usage.cacheWriteTokens ?? 0;
		totals.reasoningTokens = usage.reasoningTokens ?? 0;
		totals.calls = 1;
		if (isDeepSeekProviderRoute(provider)) totals.cost = deepseekModelSpend(model, totals, atMs);
		return totals;
	}
	async loadPersisted() {
		try {
			const [rawLedger, rawSnapshots] = await Promise.all([readFile(this.ledgerPath, "utf8").catch(() => void 0), readFile(this.snapshotsPath, "utf8").catch(() => void 0)]);
			if (rawLedger !== void 0) {
				const loaded = deserializeLedger(JSON.parse(rawLedger));
				for (const [dayKey, providers] of Object.entries(loaded.days)) {
					const atMs = (/* @__PURE__ */ new Date(dayKey + "T12:00:00")).getTime();
					for (const [provider, models] of Object.entries(providers)) for (const [model, totals] of Object.entries(models)) foldUsage(this.ledger, atMs, provider, model, totals);
				}
				pruneLedger(this.ledger, localDateKey(Date.now()), this.options.retainDays);
				this.lastPrune = {
					dayKey: localDateKey(Date.now()),
					retainDays: this.options.retainDays
				};
			}
			if (rawSnapshots !== void 0) {
				const parsed = JSON.parse(rawSnapshots);
				if (typeof parsed === "object" && parsed !== null && typeof parsed.providers === "object" && parsed.providers !== null) {
					for (const [provider, snapshot] of Object.entries(parsed.providers)) if (typeof snapshot === "object" && snapshot !== null && typeof snapshot.provider === "string") this.snapshots.set(provider, snapshot);
				}
				const watch = parsed.spendWatch;
				if (typeof watch === "object" && watch !== null && typeof watch.accruedCny === "number" && Number.isFinite(watch.accruedCny) && watch.accruedCny >= 0 && typeof watch.since === "number" && Number.isFinite(watch.since) && watch.since > 0) this.spendWatch = {
					accruedCny: watch.accruedCny,
					since: watch.since,
					...typeof watch.lastBalanceCny === "number" && Number.isFinite(watch.lastBalanceCny) ? { lastBalanceCny: watch.lastBalanceCny } : {}
				};
			}
		} catch {} finally {
			this.loaded = true;
		}
	}
	scheduleFlush() {
		if (this.flushTimer !== void 0 || this.disposed) return;
		this.flushTimer = setTimeout(() => {
			this.flushTimer = void 0;
			this.flushLedger();
		}, FLUSH_DEBOUNCE_MS);
	}
	/**
	* Queue one ledger flush behind the previous one. Debounce and stop-time
	* flushes serialize here, so two `writeJsonAtomic` calls can never run
	* concurrently on the same path.
	*/
	flushLedger() {
		const next = this.flushChain.then(() => this.writeLedgerOnce());
		this.flushChain = next.catch(() => {});
		return next;
	}
	async writeLedgerOnce() {
		if (!this.loaded) return;
		try {
			await mkdir(dirname(this.ledgerPath), { recursive: true });
			await writeJsonAtomic(this.ledgerPath, this.ledger);
		} catch {}
	}
	/**
	* Prune days past retention. Runs at most once per local day and whenever
	* `retainDays` shrinks — not only at startup, so long-lived processes and
	* live settings changes both honor retention.
	*/
	pruneIfNeeded() {
		const todayKey = localDateKey(Date.now());
		if (this.lastPrune?.dayKey === todayKey && this.lastPrune.retainDays === this.options.retainDays) return;
		const pruned = pruneLedger(this.ledger, todayKey, this.options.retainDays);
		this.lastPrune = {
			dayKey: todayKey,
			retainDays: this.options.retainDays
		};
		if (pruned > 0) this.scheduleFlush();
	}
	async persistSnapshots() {
		if (!this.loaded) return;
		try {
			await mkdir(dirname(this.snapshotsPath), { recursive: true });
			await writeJsonAtomic(this.snapshotsPath, {
				version: 1,
				providers: Object.fromEntries(this.snapshots),
				...this.spendWatch !== void 0 ? { spendWatch: this.spendWatch } : {}
			});
		} catch {}
	}
	rearmPoll(delayMs) {
		if (this.disposed) return;
		if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
		this.pollTimer = setTimeout(() => {
			this.pollTimer = void 0;
			this.pollNow().finally(() => this.rearmPoll(Math.max(30, this.options.pollIntervalSec) * 1e3));
		}, delayMs);
	}
	/**
	* One poll cycle: enumerate routes, resolve credentials, probe.
	* A call while a cycle is already running joins that cycle instead of
	* returning immediately, so a manual refresh always waits for real probes.
	*/
	pollNow() {
		if (this.pollInFlight) return this.pollPromise ?? Promise.resolve();
		if (this.disposed) return Promise.resolve();
		this.pollInFlight = true;
		const cycle = (async () => {
			try {
				this.pruneIfNeeded();
				const routes = this.listProviderRoutes();
				const seen = /* @__PURE__ */ new Set();
				for (const route of routes) {
					if (this.disposed) return;
					seen.add(route.id);
					const adapter = adapterFor(route.id);
					if (adapter === void 0 || adapter.balance === void 0 && adapter.plan === void 0) continue;
					await this.probeRoute(route, adapter);
				}
				for (const id of [...this.snapshots.keys()]) if (!seen.has(id)) this.snapshots.delete(id);
				if (this.disposed) return;
				this.accrueDeepSeekSpend();
				await this.persistSnapshots();
			} finally {
				this.pollInFlight = false;
				this.pollPromise = void 0;
			}
		})();
		this.pollPromise = cycle;
		return cycle;
	}
	/**
	* Every route the service probes and renders: the runtime's live providers
	* plus the configurable directory's catalog entries, then alias-folded so a
	* dormant catalog entry cannot shadow the live route of the same adapter
	* family (see foldAliasRoutes).
	*/
	listProviderRoutes() {
		const routes = /* @__PURE__ */ new Map();
		const runtime = service(this.ctx, "llm");
		if (runtime !== void 0) try {
			for (const provider of runtime.listProviders()) if (provider.id !== "") routes.set(provider.id, {
				id: provider.id,
				displayName: provider.name,
				live: true
			});
			for (const provider of runtime.listConfigurableProviders()) if (!routes.has(provider.provider)) routes.set(provider.provider, {
				id: provider.provider,
				displayName: provider.displayName,
				live: false
			});
		} catch {}
		return foldAliasRoutes([...routes.values()]);
	}
	async probeRoute(route, adapter) {
		const credential = await this.resolveCredential(route.id);
		const previous = this.snapshots.get(route.id);
		const balanceApplies = balanceAppliesToRoute(adapter, this.routeBaseUrl(route.id));
		if (credential.key === void 0) {
			this.snapshots.set(route.id, {
				provider: route.id,
				displayName: route.displayName || adapter.displayName,
				credential: credential.kind,
				supported: true,
				updatedAt: Date.now()
			});
			return;
		}
		const snapshot = {
			provider: route.id,
			displayName: route.displayName || adapter.displayName,
			credential: credential.kind,
			supported: true,
			...adapter.balance !== void 0 && !balanceApplies ? { balanceSupported: false } : {},
			updatedAt: Date.now()
		};
		const runProbe = async (kind) => {
			const half = adapter[kind];
			if (half === void 0) return void 0;
			if (kind === "balance" && !balanceApplies) return void 0;
			try {
				const spec = half.build({
					apiKey: credential.key,
					...credential.accountId !== void 0 ? { accountId: credential.accountId } : {}
				});
				const response = await fetch(spec.url, withIdentityEncoding({
					headers: spec.headers,
					signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
				}));
				const body = await response.json().catch(() => void 0);
				if (!response.ok) throw new Error(providerErrorMessage(response.status, body));
				const parsed = half.parse(response.status, body);
				if (parsed === void 0) throw new Error("unrecognized response shape");
				const updatedAt = Date.now();
				if (kind === "balance") {
					const fact = parsed;
					return {
						currency: fact.currency,
						totalBalance: fact.totalBalance,
						updatedAt
					};
				}
				const plan = parsed;
				return {
					planName: plan.planName,
					windows: plan.windows,
					updatedAt
				};
			} catch (error) {
				const message = error instanceof Error ? error.message.slice(0, 200) : String(error);
				if (kind === "balance") snapshot.balanceError = message;
				else snapshot.planError = message;
				return;
			}
		};
		const balance = await runProbe("balance");
		if (balance !== void 0) snapshot.balance = balance;
		else if (previous?.balance !== void 0) snapshot.balance = previous.balance;
		const plan = await runProbe("plan");
		if (plan !== void 0) snapshot.plan = plan;
		else if (previous?.plan !== void 0) snapshot.plan = previous.plan;
		this.snapshots.set(route.id, snapshot);
	}
	/**
	* Resolve the credential backing one route: pi-ai credential records
	* first, then the profile's apiKeyEnv reference, then the DeepSeek
	* official adapter's env reference. OAuth grants hand their stored access
	* token to the oauth-aware adapters (Codex plan quota); a stale token
	* fails its probe with a 401 and refreshes the next time the harness
	* itself runs that provider.
	*/
	async resolveCredential(provider) {
		const credentials = service(this.ctx, "credentials");
		if (credentials === void 0) return { kind: "none" };
		try {
			const record = await credentials.readRecord(credentialKey("llm-pi-ai", provider));
			if (record?.kind === "api-key" && typeof record.key === "string" && record.key !== "") return {
				kind: "api-key",
				key: record.key
			};
			if (record?.kind === "grant" && typeof record.payload === "object" && record.payload !== null) {
				const payload = record.payload;
				const access = typeof payload.access === "string" && payload.access !== "" ? payload.access : void 0;
				const accountId = typeof payload.chatgpt_account_id === "string" && payload.chatgpt_account_id !== "" ? payload.chatgpt_account_id : void 0;
				if (access !== void 0) return {
					kind: "oauth",
					key: access,
					...accountId !== void 0 ? { accountId } : {}
				};
				return { kind: "oauth" };
			}
		} catch {}
		try {
			const envName = this.piAiProfile(provider)?.apiKeyEnv ?? (isDeepSeekProviderRoute(provider) ? this.deepseekApiKeyEnv() : void 0);
			if (typeof envName === "string" && envName !== "") {
				const resolved = await credentials.resolve(credentialRef(envName));
				if (resolved?.value !== void 0 && resolved.value !== "") return {
					kind: "env",
					key: resolved.value
				};
			}
		} catch {}
		return { kind: "none" };
	}
	/** The llm-pi-ai profile object for one provider route, when configured. */
	piAiProfile(provider) {
		return readNamespace(this.ctx, "llm-pi-ai")?.providers?.[provider];
	}
	/** The DeepSeek official adapter's credential reference name. */
	deepseekApiKeyEnv() {
		return readNamespace(this.ctx, "llm-deepseek")?.apiKeyEnv ?? "DEEPSEEK_API_KEY";
	}
	/** The DeepSeek official adapter's configured baseURL. */
	deepseekBaseUrl() {
		return readNamespace(this.ctx, "llm-deepseek")?.baseURL;
	}
	/** The effective base URL for a provider route (pi-ai or deepseek). */
	routeBaseUrl(provider) {
		return this.piAiProfile(provider)?.baseURL ?? (isDeepSeekProviderRoute(provider) ? this.deepseekBaseUrl() : void 0);
	}
};
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
//#region src/host/pair-access.ts
/**
* Whether this request may enter the plugin's host routes.
* @param ctx - host context; may expose remoteWebUiPairing.
* @param request - the incoming HTTP request.
* @returns true for loopback, or a live paired-device cookie.
*/
function isPairedOrLoopbackAllowed(ctx, request) {
	if (isLoopbackRequest(request)) return true;
	const fromGet = typeof ctx.get === "function" ? ctx.get("remoteWebUiPairing", false) : void 0;
	return (isPairingAccess(fromGet) ? fromGet : ctx.remoteWebUiPairing)?.isPairedDevice(request) === true;
}
function isPairingAccess(value) {
	return value !== void 0 && value !== null && typeof value.isPairedDevice === "function";
}
//#endregion
//#region src/host/access.ts
/**
* Whether this request may read the usage overview or trigger a refresh.
* @param ctx - host context; may expose remoteWebUiPairing.
* @param request - the incoming HTTP request.
* @returns true for loopback, or a live paired-device cookie.
*/
function isUsageAllowed(ctx, request) {
	return isPairedOrLoopbackAllowed(ctx, request);
}
//#endregion
//#region src/host/routes.ts
/**
* Overview route: provider balances, plan quotas, and token usage totals.
* Personal account data behind the family trust fence — loopback always
* passes, and a live paired-device cookie passes too when remote-web-ui is
* loaded (issue #1592: the sidebar usage panel reads this from a paired LAN
* browser); every unpaired LAN request keeps its 403.
* @param ctx - host context; may expose remoteWebUiPairing.
* @param service - the usage service.
* @returns the route.
*/
function makeUsageOverviewRoute(ctx, service) {
	return {
		kind: "exact",
		path: "/api/dsh-usage/overview",
		handler: async (req, res) => {
			if (!isUsageAllowed(ctx, req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			writeJson(res, 200, service.overview(), { "cache-control": "no-store" });
		}
	};
}
/**
* One retained day route: `GET /api/dsh-usage/day?date=YYYY-MM-DD` answers
* that local day's per-provider and per-model totals, so the section's day
* pickers can show a past day instead of only today. Same trust fence as the
* overview route, and a key that is not a real local date is refused with 400
* rather than folded into a bogus day.
* @param ctx - host context; may expose remoteWebUiPairing.
* @param service - the usage service.
* @returns the route.
*/
function makeUsageDayRoute(ctx, service) {
	return {
		kind: "exact",
		path: "/api/dsh-usage/day",
		handler: (req, res) => {
			if (!isUsageAllowed(ctx, req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			const date = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("date") ?? "";
			if (!isLedgerDateKey(date)) {
				writeJson(res, 400, {
					ok: false,
					error: "date must be YYYY-MM-DD"
				});
				return;
			}
			writeJson(res, 200, {
				ok: true,
				day: service.day(date)
			}, { "cache-control": "no-store" });
		}
	};
}
/**
* Manual refresh: forces one probe cycle now and answers with the fresh
* overview. Same trust fence as the overview route.
* @param ctx - host context; may expose remoteWebUiPairing.
* @param service - the usage service.
* @returns the route.
*/
function makeUsageRefreshRoute(ctx, service) {
	return {
		kind: "exact",
		path: "/api/dsh-usage/refresh",
		handler: async (req, res) => {
			if (!isUsageAllowed(ctx, req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			try {
				await service.refresh();
			} catch (error) {
				writeJson(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : "refresh failed"
				});
				return;
			}
			writeJson(res, 200, service.overview(), { "cache-control": "no-store" });
		}
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-usage";
const inject = ["webServer"];
/**
* Family settings namespace this row serves. Since 0.1.7 the settings surface
* addresses one form per profile entry id and the Host generates this row's
* page from the Config schema below, so the namespace is only the alias the
* family settings bridge (dsh-web-settings) resolves onto this row's entry id.
*/
const USAGE_SETTINGS_NAMESPACE = "dsh-usage";
/**
* Plugin config schema. Under the 0.1.7 settings model this schema IS the
* entry's settings page: the Host derives one form per profile entry from it
* and serves it only when at least one field is `volatile()`. The marker is
* also what admits a write and what keeps the edit on the live path — the
* Loader commits the new value into the field's reference and announces
* `loader/volatile-update` on this fiber instead of remounting the row, so the
* probe cycle, its ledger and its route registrations survive a settings save.
*
* The schema is left to inference rather than annotated with
* `z<UsageConfigFields>`: a volatile field's parsed output is a reference while
* its accepted input stays the plain value, so the two sides no longer share
* one shape and the annotation would reject the schema the Host must be given.
*/
const Config = z.object({
	enabled: z.boolean().default(true).volatile(),
	pollIntervalSec: z.number().min(30).max(3600).default(60).volatile(),
	retainDays: z.number().min(7).max(730).default(180).volatile()
});
/** Read one config field, following the live reference the schema produces. */
function readConfigField(field) {
	if (field === void 0) return void 0;
	if (typeof field === "object" && field !== null && typeof field.get === "function") return field.get();
	return field;
}
/** Read one numeric field, falling back when the value is absent or not a usable number. */
function readNumber(field, fallback) {
	const value = readConfigField(field);
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/**
* Resolve the effective settings of one activation. Volatile references are
* read here, so every re-arm observes the latest committed values rather than
* whatever the row was activated with.
* @param config - the config the Host passed to the activation.
* @returns the resolved settings.
*/
function resolveConfig(config) {
	return {
		enabled: readConfigField(config?.enabled) ?? true,
		pollIntervalSec: readNumber(config?.pollIntervalSec, 60),
		retainDays: readNumber(config?.retainDays, 180)
	};
}
/**
* Tail of the process-wide flush chain; undefined while no predecessor's final
* ledger flush is still in flight. The Host reloads this profile row when its
* configuration changes, so a successor activation is a dispose + apply pair in
* the same process: its first ledger load must serialize behind its
* predecessor's final write (and behind the reloads before that one).
*/
let pendingStop;
/**
* Host body. The plugin's own Config schema above is the settings document the
* 0.1.7 Host serves for this row; the effective config arrives here as the
* `config` argument, and a settings save re-enters this body through the
* volatile path rather than a row reload (see {@link Config}).
* @param ctx - host root context.
* @param config - the row's resolved configuration.
*/
const apply = mountOnce("@fish-under-sea/dsh-usage", (ctx, config) => {
	let live = true;
	let service;
	let disposeRoutes;
	/** True while this activation has a start queued behind a predecessor's flush. */
	let queued = false;
	/** Register the service's routes; the returned disposer unregisters them. */
	const mountRoutes = (next) => {
		const disposers = [
			makeUsageOverviewRoute(ctx, next),
			makeUsageDayRoute(ctx, next),
			makeUsageRefreshRoute(ctx, next)
		].map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) try {
				dispose();
			} catch {}
		};
	};
	/** Start a fresh activation, unless this fiber is down or one already runs. */
	const launch = () => {
		queued = false;
		if (!live || service !== void 0) return;
		const value = resolveConfig(config);
		if (!value.enabled) return;
		const next = new UsageService(ctx, value);
		service = next;
		next.start();
		disposeRoutes = mountRoutes(next);
	};
	/** Tear the running activation down, chaining its final flush for any successor. */
	const stop = () => {
		disposeRoutes?.();
		disposeRoutes = void 0;
		const stopping = service?.stop();
		service = void 0;
		if (stopping !== void 0) pendingStop = (pendingStop ?? Promise.resolve()).then(() => stopping);
	};
	/**
	* Apply the activation's current settings: a disabled row mounts nothing (no
	* probe cycle, no ledger, no routes), an enabled one starts on first use and
	* otherwise re-applies its options in place.
	*/
	const rearm = () => {
		const value = resolveConfig(config);
		if (!value.enabled) {
			queued = false;
			stop();
			return;
		}
		if (service !== void 0) {
			service.applyOptions(value);
			return;
		}
		if (queued) return;
		if (pendingStop === void 0) {
			launch();
			return;
		}
		queued = true;
		pendingStop = pendingStop.then(launch, launch).then(() => void 0);
	};
	ctx.on("loader/volatile-update", () => {
		rearm();
	});
	ctx.effect(() => {
		rearm();
		return () => {
			live = false;
			queued = false;
			stop();
		};
	}, "dsh-usage: runtime");
});
//#endregion
export { Config, USAGE_SETTINGS_NAMESPACE, apply, inject, name, resolveConfig };
