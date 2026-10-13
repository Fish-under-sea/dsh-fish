window.__ModuleLoader__.load({
	id: "@fish-under-sea/dsh-session-archive-fish",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		/**
		* Protected-reason map for preview surfaces. `running` and `current` are the
		* two facts the browser half knows; the host adds `in-flight` and re-checks
		* everything authoritatively.
		*/
		function clientProtectedReason(rows, currentSessionId) {
			const map = /* @__PURE__ */ new Map();
			for (const row of rows) if (row.running) map.set(row.id, "running");
			if (currentSessionId !== void 0 && currentSessionId !== "") map.set(currentSessionId, "current");
			return map;
		}
		//#endregion
		//#region src/client/api.ts
		const DEFAULT_TIMEOUT_MS = 3e4;
		/** Batch deletes of thousands of sessions can take a while server-side. */
		const BATCH_TIMEOUT_MS = 3e5;
		var ArchiveApiError = class extends Error {
			status;
			body;
			constructor(status, body) {
				super(`archive api failed (${status})${typeof body === "string" ? `: ${body}` : ""}`);
				this.status = status;
				this.body = body;
			}
		};
		async function request(path, init, timeoutMs) {
			const response = await fetch(path, {
				...init,
				headers: {
					"content-type": "application/json",
					...init?.headers
				},
				signal: AbortSignal.timeout(timeoutMs)
			});
			const body = await response.json().catch(() => void 0);
			if (!response.ok) {
				const detail = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : void 0;
				throw new ArchiveApiError(response.status, detail === void 0 ? body : `${response.status}: ${detail}`);
			}
			return body;
		}
		function post(ids, extra) {
			return {
				method: "POST",
				body: JSON.stringify({
					ids,
					...extra
				})
			};
		}
		function createArchiveApi() {
			const prefix = "api/dsh-session-archive";
			return {
				inventory: () => request(`${prefix}/inventory`, void 0, DEFAULT_TIMEOUT_MS),
				preview: (id) => request(`${prefix}/preview?id=${encodeURIComponent(id)}`, void 0, DEFAULT_TIMEOUT_MS),
				archive: (ids, currentSessionId) => request(`${prefix}/archive`, post(ids, currentSessionId === void 0 ? {} : { currentSessionId }), BATCH_TIMEOUT_MS),
				unarchive: (ids) => request(`${prefix}/unarchive`, post(ids, {}), BATCH_TIMEOUT_MS),
				deleteSessions: (ids, currentSessionId, expectedTotal) => request(`${prefix}/delete`, post(ids, {
					...currentSessionId === void 0 ? {} : { currentSessionId },
					expectedTotal
				}), BATCH_TIMEOUT_MS),
				autoPreview: () => request(`${prefix}/auto/preview`, void 0, DEFAULT_TIMEOUT_MS),
				autoRun: (kind, currentSessionId) => request(`${prefix}/auto/run`, {
					method: "POST",
					body: JSON.stringify({
						kind,
						...currentSessionId === void 0 ? {} : { currentSessionId }
					})
				}, BATCH_TIMEOUT_MS)
			};
		}
		//#endregion
		//#region \0dsh-store-engine
		const platform = ["@deepseek-ai/dsh-client", "-store"].join("");
		const legacy = ["@deepseek-ai/dsh-client-runtime", "/client"].join("");
		let engine;
		try {
			engine = require(platform);
		} catch {
			engine = require(legacy);
		}
		engine.createSnapshotStore;
		const defineStore = engine.defineStore;
		engine.shallowEqual;
		//#endregion
		//#region src/core/selection.ts
		/**
		* The section opens on the ARCHIVED view (the management surface's primary
		* audience) with pagination at 20 rows per page. Filtering/sorting resets to
		* the first page; selection always spans the complete filtered set, never
		* just the current page.
		*/
		const DEFAULT_FILTER_STATE = {
			status: "archived",
			workspaceId: "any",
			query: "",
			issuesOnly: false
		};
		function matchesQuery(row, query) {
			const needle = query.trim().toLowerCase();
			if (needle === "") return true;
			if (row.id.toLowerCase().includes(needle)) return true;
			return row.title !== void 0 && row.title.toLowerCase().includes(needle);
		}
		function filterRows(rows, filter) {
			const query = filter.query.trim().toLowerCase();
			return rows.filter((row) => {
				if (filter.status === "active" && row.archived) return false;
				if (filter.status === "archived" && !row.archived) return false;
				if (filter.workspaceId === "none" && row.workspaceIds.length > 0) return false;
				if (filter.workspaceId !== "any" && filter.workspaceId !== "none" && !row.workspaceIds.includes(filter.workspaceId)) return false;
				if (filter.issuesOnly && row.issues.length === 0) return false;
				return matchesQuery(row, query);
			});
		}
		function timeOr(row, key) {
			if (key === "lastActivity") return row.lastActivityAt;
			if (key === "archivedAt") return row.archivedAt;
			if (key === "createdAt") return row.createdAt;
		}
		function sortRows(rows, key, dir) {
			const sign = dir === "asc" ? 1 : -1;
			const copy = [...rows];
			copy.sort((a, b) => {
				if (key === "title") {
					const at = a.title ?? "";
					const bt = b.title ?? "";
					if (at !== bt) return sign * at.localeCompare(bt);
					return a.id.localeCompare(b.id);
				}
				if (key === "size") {
					const av = a.sizeBytes;
					const bv = b.sizeBytes;
					if (av === void 0 && bv === void 0) return a.id.localeCompare(b.id);
					if (av === void 0) return 1;
					if (bv === void 0) return -1;
					if (av !== bv) return sign * (av - bv);
					return a.id.localeCompare(b.id);
				}
				const av = timeOr(a, key);
				const bv = timeOr(b, key);
				if (av === void 0 && bv === void 0) return a.id.localeCompare(b.id);
				if (av === void 0) return 1;
				if (bv === void 0) return -1;
				if (av !== bv) return sign * (av - bv);
				return a.id.localeCompare(b.id);
			});
			return copy;
		}
		function selectionSummary(selection, filtered) {
			let inside = 0;
			for (const row of filtered) if (selection.has(row.id)) inside += 1;
			const selected = selection.size;
			return {
				selected,
				inside,
				outside: selected - inside
			};
		}
		//#endregion
		//#region src/client/archive-store.ts
		/**
		* Browser-side store for the session-archive section: inventory, filters,
		* selection (as an id array — store drafts are plain data), batch progress,
		* preview lifecycle, and the delete-confirmation state.
		* @module @fish-under-sea/dsh-session-archive-fish/client/archive-store
		*/
		function createArchiveStore() {
			return defineStore({
				init: () => ({
					inventory: null,
					status: "loading",
					error: null,
					filter: { ...DEFAULT_FILTER_STATE },
					sortKey: "lastActivity",
					sortDir: "desc",
					page: 0,
					selection: [],
					batch: null,
					preview: null,
					confirmDelete: null,
					autoPreview: null,
					autoPreviewLoading: false
				}),
				actions: {
					setInventory: (draft, inventory) => {
						draft.inventory = inventory;
						draft.status = "ready";
						draft.error = null;
						if (draft.selection.length > 0) {
							const alive = new Set(inventory.rows.map((row) => row.id));
							const pruned = draft.selection.filter((id) => alive.has(id));
							if (pruned.length !== draft.selection.length) draft.selection = pruned;
						}
					},
					setStatus: (draft, status, error) => {
						draft.status = status;
						draft.error = error;
					},
					setFilter: (draft, patch) => {
						draft.filter = {
							...draft.filter,
							...patch
						};
						draft.page = 0;
					},
					setSort: (draft, key, dir) => {
						draft.sortKey = key;
						draft.sortDir = dir;
						draft.page = 0;
					},
					setPage: (draft, page) => {
						draft.page = Math.max(0, page);
					},
					toggleRow: (draft, id, on) => {
						const has = draft.selection.includes(id);
						if (on && !has) draft.selection.push(id);
						if (!on && has) draft.selection = draft.selection.filter((entry) => entry !== id);
					},
					selectMany: (draft, ids, on) => {
						const set = new Set(draft.selection);
						for (const id of ids) if (on) set.add(id);
						else set.delete(id);
						draft.selection = [...set];
					},
					clearSelection: (draft) => {
						draft.selection = [];
					},
					startBatch: (draft, kind, total) => {
						draft.batch = {
							kind,
							total,
							processed: 0,
							results: [],
							running: true,
							error: null,
							freedBytes: 0
						};
					},
					batchChunk: (draft, results, freedBytes) => {
						if (draft.batch === void 0 || draft.batch === null) return;
						const known = new Set(draft.batch.results.map((entry) => entry.id));
						const fresh = results.filter((entry) => !known.has(entry.id));
						draft.batch.results.push(...fresh);
						draft.batch.processed += fresh.length;
						draft.batch.freedBytes += freedBytes;
					},
					finishBatch: (draft, error, freedBytes) => {
						if (draft.batch === void 0 || draft.batch === null) return;
						draft.batch.running = false;
						draft.batch.error = error;
						if (draft.batch.freedBytes === 0 && error === null) draft.batch.freedBytes = freedBytes;
					},
					closeBatch: (draft) => {
						draft.batch = null;
					},
					setPreview: (draft, preview) => {
						draft.preview = preview;
					},
					setConfirmDelete: (draft, state) => {
						draft.confirmDelete = state;
					},
					setAutoPreview: (draft, preview, loading) => {
						draft.autoPreview = preview;
						draft.autoPreviewLoading = loading;
					}
				}
			});
		}
		//#endregion
		//#region src/client/archive-controller.ts
		/** Max sessions per HTTP chunk: bounded work per request, no per-row spam. */
		const CHUNK_SIZE = 200;
		/** Partition delete targets into family-intact chunks of at most CHUNK_SIZE. */
		function chunkDeleteTargets(rows, targets) {
			const childIds = /* @__PURE__ */ new Map();
			for (const row of rows) childIds.set(row.id, row.childIds);
			const descendants = (id) => {
				const seen = /* @__PURE__ */ new Set();
				const queue = [...childIds.get(id) ?? []];
				while (queue.length > 0) {
					const current = queue.pop();
					if (seen.has(current)) continue;
					seen.add(current);
					for (const child of childIds.get(current) ?? []) if (!seen.has(child)) queue.push(child);
				}
				return [...seen];
			};
			const assigned = /* @__PURE__ */ new Set();
			const chunks = [];
			let current = [];
			for (const id of targets) {
				if (assigned.has(id)) continue;
				const family = [id, ...descendants(id).filter((member) => !assigned.has(member))];
				for (const member of family) assigned.add(member);
				if (current.length > 0 && current.length + family.length > CHUNK_SIZE) {
					chunks.push(current);
					current = [];
				}
				current.push(...family);
				if (current.length >= CHUNK_SIZE) {
					chunks.push(current);
					current = [];
				}
			}
			if (current.length > 0) chunks.push(current);
			return chunks;
		}
		/** Plain fixed-size chunking for archive/unarchive. */
		function chunkPlain(ids, size = CHUNK_SIZE) {
			const chunks = [];
			for (let index = 0; index < ids.length; index += size) chunks.push(ids.slice(index, index + size));
			return chunks;
		}
		var ArchiveController = class {
			store;
			api;
			sessions;
			constructor(deps = {}) {
				this.api = deps.api ?? createArchiveApi();
				this.store = deps.store ?? createArchiveStore().create();
				this.sessions = deps.sessions;
			}
			/** The main-view Session id from the sessions face, when available. */
			getCurrentSessionId() {
				try {
					return this.sessions?.current?.();
				} catch {
					return;
				}
			}
			currentSessionId() {
				return this.getCurrentSessionId();
			}
			async load() {
				const actions = this.store.actions;
				actions.setStatus("loading", null);
				try {
					const inventory = await this.api.inventory();
					actions.setInventory(inventory);
				} catch (error) {
					actions.setStatus("error", error instanceof Error ? error.message : String(error));
				}
			}
			/** The delete plan the confirm dialog shows, from the current snapshot. */
			planDeleteFor(directIds) {
				const rows = this.store.getSnapshot().inventory?.rows ?? [];
				const plan = planDelete(rows, directIds, clientProtectedReason(rows, this.currentSessionId()));
				return {
					plan,
					totalBytes: plan.totalBytes
				};
			}
			async confirmDelete(directIds) {
				const { plan } = this.planDeleteFor(directIds);
				const directSet = new Set(directIds);
				const strong = plan.targets.length > 50;
				this.store.actions.setConfirmDelete({
					ids: [...directIds],
					total: plan.targets.length,
					descendants: plan.targets.filter((id) => !directSet.has(id)).length,
					skippedProtected: plan.skipped.length,
					totalBytes: plan.totalBytes,
					strong
				});
			}
			/** Execute one batch kind over explicit ids, updating progress per chunk. */
			async runBatch(kind, directIds) {
				const rows = this.store.getSnapshot().inventory?.rows ?? [];
				const actions = this.store.actions;
				actions.setConfirmDelete(null);
				let plannedTargets;
				let chunks;
				let chunkTotals;
				let preSkipped = [];
				if (kind === "delete") {
					const plan = planDelete(rows, directIds, clientProtectedReason(rows, this.currentSessionId()));
					plannedTargets = plan.targets;
					preSkipped = plan.skipped;
					chunks = chunkDeleteTargets(rows, plannedTargets);
					chunkTotals = chunks.map((chunk) => chunk.length);
				} else {
					plannedTargets = [...new Set(directIds)];
					chunks = chunkPlain(plannedTargets);
				}
				actions.startBatch(kind, plannedTargets.length + preSkipped.length);
				if (preSkipped.length > 0) actions.batchChunk(preSkipped, 0);
				let freed = 0;
				let failure = null;
				try {
					for (let index = 0; index < chunks.length; index += 1) {
						const chunk = chunks[index];
						let response;
						try {
							if (kind === "archive") response = await this.api.archive(chunk, this.currentSessionId());
							else if (kind === "unarchive") response = await this.api.unarchive(chunk);
							else response = await this.api.deleteSessions(chunk, this.currentSessionId(), chunkTotals?.[index] ?? chunk.length);
						} catch (error) {
							const detail = error instanceof Error ? error.message : String(error);
							actions.batchChunk(chunk.map((id) => ({
								id,
								status: "failed",
								reason: "error",
								detail
							})), 0);
							if (failure === null) failure = detail;
							continue;
						}
						actions.batchChunk(response.results, response.freedBytes);
						freed += response.freedBytes;
					}
				} finally {
					actions.finishBatch(failure, freed);
					await this.load();
					if (kind === "delete" || kind === "unarchive") try {
						await this.sessions?.refresh?.();
					} catch {}
				}
			}
			/** Retry only the failed ids of the last batch, same kind. */
			async retryFailed() {
				const batch = this.store.getSnapshot().batch;
				if (batch === null || batch.running) return;
				const failedIds = batch.results.filter((result) => result.status === "failed").map((result) => result.id);
				if (failedIds.length === 0) return;
				await this.runBatch(batch.kind, failedIds);
			}
			async openPreview(id) {
				const actions = this.store.actions;
				actions.setPreview({
					id,
					status: "loading"
				});
				try {
					const data = await this.api.preview(id);
					actions.setPreview({
						id,
						status: "ready",
						data
					});
				} catch (error) {
					actions.setPreview({
						id,
						status: "error",
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			async refreshAutoPreview() {
				const actions = this.store.actions;
				actions.setAutoPreview(null, true);
				try {
					const preview = await this.api.autoPreview();
					actions.setAutoPreview(preview, false);
				} catch {
					actions.setAutoPreview(null, false);
				}
			}
			async runAuto(kind) {
				try {
					await this.api.autoRun(kind, this.currentSessionId());
				} catch {}
				await this.load();
				await this.refreshAutoPreview();
			}
		};
		//#endregion
		//#region src/client/main-session.ts
		/**
		* Resolve the Session the main view currently shows.
		*
		* Reads the catalog's rows rather than a per-id retain-info source: ownership
		* counts ride the list snapshot, so this neither allocates observers nor opens
		* history, and a subscription to the list still fires when the selection moves.
		* @param byId - the session catalog's rows (`SessionListState.byId`), when available.
		* @returns the main-view session id, or undefined when the main view shows none.
		*/
		function mainViewSessionId(byId) {
			if (byId === void 0 || byId === null) return void 0;
			for (const row of Object.values(byId)) if (row !== void 0 && (row.retainedBy?.mainView ?? 0) > 0) return row.id;
		}
		//#endregion
		//#region src/client/locales.ts
		/** Dictionary namespace this package registers. */
		const NS = "dsh-web-ui-session-archive";
		/** Chinese copy (key source). */
		const zh = {
			"arch.nav": "已归档会话",
			"arch.title": "会话归档管理",
			"arch.refresh": "刷新",
			"arch.refreshing": "刷新中…",
			"arch.loading": "正在加载会话列表…",
			"arch.error": "加载失败：{error}",
			"arch.retry": "重试",
			"arch.close": "关闭",
			"arch.empty": "当前条件下没有会话",
			"arch.page.prev": "上一页",
			"arch.page.next": "下一页",
			"arch.page.info": "第 {page} / {pages} 页 · 共 {n} 条",
			"arch.results.count": "共 {n} 条会话",
			"arch.filter.all": "全部",
			"arch.filter.active": "未归档",
			"arch.filter.archived": "已归档",
			"arch.filter.workspace": "工作区",
			"arch.filter.workspace.any": "全部工作区",
			"arch.filter.workspace.none": "不属于任何工作区",
			"arch.filter.search": "搜索标题或会话 ID",
			"arch.filter.issues": "仅看异常会话",
			"arch.sort": "排序",
			"arch.sort.lastActivity": "最后活动时间",
			"arch.sort.archivedAt": "归档时间",
			"arch.sort.createdAt": "创建时间",
			"arch.sort.title": "标题",
			"arch.sort.size": "占用空间",
			"arch.sort.asc": "最早优先",
			"arch.sort.desc": "最新优先",
			"arch.row.noTitle": "（无标题）",
			"arch.row.lastActivity": "最后活动：{time}",
			"arch.row.lastActivity.unknown": "最后活动：未知",
			"arch.row.archivedAt": "归档时间：{time}",
			"arch.row.archivedAt.unknown": "归档时间：未知",
			"arch.row.size": "大小：{size}",
			"arch.row.children": "{n} 个子会话",
			"arch.row.created": "创建于 {time}",
			"arch.status.running": "运行中",
			"arch.status.blank": "空白",
			"arch.status.archived": "已归档",
			"arch.status.active": "普通",
			"arch.status.subagent": "子会话",
			"arch.issue.no-title": "缺少标题",
			"arch.issue.no-archive-time": "归档时间未知",
			"arch.issue.unreadable": "元数据不完整",
			"arch.issue.no-data": "无会话数据",
			"arch.op.archive": "归档",
			"arch.op.unarchive": "取消归档",
			"arch.op.delete": "删除",
			"arch.op.preview": "预览",
			"arch.select.all": "全选当前结果",
			"arch.select.clear": "清空选择",
			"arch.select.selected": "已选 {n} 项",
			"arch.select.holdNote": "已选 {selected} 项，其中 {outside} 项不在当前筛选结果中，操作时仍会包含它们",
			"arch.batch.archive": "批量归档",
			"arch.batch.unarchive": "批量取消归档",
			"arch.batch.delete": "批量删除",
			"arch.confirm.deleteTitle": "删除会话",
			"arch.confirm.direct": "直接选中：{n} 个会话",
			"arch.confirm.descendants": "因父子关系一并删除：{n} 个会话",
			"arch.confirm.total": "最终删除总数：{n} 个会话",
			"arch.confirm.skipped": "将被跳过的受保护会话：{n} 个",
			"arch.confirm.freed": "预计释放空间：{size}",
			"arch.confirm.irrecoverable": "物理删除不可恢复，会话内容将永久丢失，且无法从回收站找回。",
			"arch.confirm.strongCheck": "我已知晓此操作不可恢复",
			"arch.confirm.confirm": "确认删除",
			"arch.confirm.cancel": "取消",
			"arch.batch.title.archive": "批量归档",
			"arch.batch.title.unarchive": "批量取消归档",
			"arch.batch.title.delete": "批量删除",
			"arch.batch.progress": "进度：{processed} / {total}",
			"arch.batch.ok": "成功：{n}",
			"arch.batch.skipped": "跳过：{n}",
			"arch.batch.failed": "失败：{n}",
			"arch.batch.freed": "已释放空间：{size}",
			"arch.batch.running": "正在处理…",
			"arch.batch.finished": "已完成",
			"arch.batch.skipSummary": "跳过明细：{summary}",
			"arch.batch.withError": "已完成（部分请求失败）",
			"arch.batch.retryFailed": "仅重试失败项",
			"arch.batch.reason": "原因",
			"arch.reason.running": "会话正在运行",
			"arch.reason.attached": "会话仍被 DSH 进程占用，重启服务或关闭该会话后可删除",
			"arch.reason.current": "会话当前正在查看",
			"arch.reason.in-flight": "会话正被其他操作处理",
			"arch.reason.not-found": "会话不存在",
			"arch.reason.already-archived": "会话已归档",
			"arch.reason.not-archived": "会话未归档",
			"arch.reason.family-protected": "会话族中存在受保护成员，已整族跳过",
			"arch.reason.unreadable": "无法读取会话数据",
			"arch.reason.missing-seam": "当前 SDK 环境不支持该操作",
			"arch.reason.busy": "其他操作正在进行",
			"arch.reason.error": "操作失败",
			"arch.preview.title": "会话预览",
			"arch.preview.messages": "共 {n} 条对话消息",
			"arch.preview.empty": "该会话没有可展示的对话内容",
			"arch.preview.loadError": "预览加载失败：{error}",
			"arch.preview.basic": "基本信息",
			"arch.preview.excerpt": "对话摘要（前几条）",
			"arch.auto.title": "自动维护",
			"arch.auto.defaultOff": "自动归档与自动删除默认关闭；未启用时不会修改任何会话状态。",
			"arch.auto.archiveToggle": "自动归档超过阈值未活动的会话",
			"arch.auto.archiveDays": "未活动天数阈值",
			"arch.auto.deleteToggle": "自动物理删除超过保留期的归档会话",
			"arch.auto.deleteDays": "归档保留天数",
			"arch.auto.days.unit": "天",
			"arch.auto.invalidDays": "天数必须是 {min} 到 {max} 之间的整数",
			"arch.auto.preview": "按当前配置预览",
			"arch.auto.preview.loading": "正在统计…",
			"arch.auto.preview.archive": "预计自动归档：{n} 个会话",
			"arch.auto.preview.delete": "预计自动删除：{n} 个会话，释放 {size}",
			"arch.auto.preview.none": "按当前配置没有会话需要处理",
			"arch.auto.runArchive": "立即执行一次自动归档",
			"arch.auto.runDelete": "立即执行一次自动清理",
			"arch.auto.lastArchive": "上次自动归档：{time}，共 {total}（成功 {ok} / 跳过 {skipped} / 失败 {failed}）",
			"arch.auto.lastDelete": "上次自动清理：{time}，共 {total}（成功 {ok} / 跳过 {skipped} / 失败 {failed}）",
			"arch.auto.nextRun": "下次预计检查：{time}",
			"arch.auto.neverRun": "尚未运行",
			"arch.auto.basis": "口径说明：自动归档按会话最后活动时间判断（不是创建时间）；自动删除按归档时间判断（不是文件时间）。归档时间未知的历史归档会话不会被自动删除，恢复后再次归档将重新计算保留期。运行中、当前正在查看以及有运行中子会话的会话始终受保护。",
			"arch.auto.cycleRunning": "自动检查正在运行…",
			"arch.auto.saveFailed": "保存失败：宿主未接受该设置，请重试",
			"arch.auto.runError": "执行失败：{error}",
			"arch.time.unknown": "未知",
			"arch.current.badge": "当前"
		};
		/** English mirror (same key set). */
		const en = {
			"arch.nav": "Archived sessions",
			"arch.title": "Session Archive Manager",
			"arch.refresh": "Refresh",
			"arch.refreshing": "Refreshing…",
			"arch.loading": "Loading sessions…",
			"arch.error": "Load failed: {error}",
			"arch.retry": "Retry",
			"arch.close": "Close",
			"arch.empty": "No sessions match the current conditions",
			"arch.page.prev": "Previous page",
			"arch.page.next": "Next page",
			"arch.page.info": "Page {page} / {pages} · {n} in total",
			"arch.results.count": "{n} sessions in total",
			"arch.filter.all": "All",
			"arch.filter.active": "Unarchived",
			"arch.filter.archived": "Archived",
			"arch.filter.workspace": "Workspace",
			"arch.filter.workspace.any": "All workspaces",
			"arch.filter.workspace.none": "No workspace",
			"arch.filter.search": "Search title or session ID",
			"arch.filter.issues": "Only sessions with issues",
			"arch.sort": "Sort",
			"arch.sort.lastActivity": "Last activity",
			"arch.sort.archivedAt": "Archive time",
			"arch.sort.createdAt": "Created at",
			"arch.sort.title": "Title",
			"arch.sort.size": "Size",
			"arch.sort.asc": "Oldest first",
			"arch.sort.desc": "Newest first",
			"arch.row.noTitle": "(untitled)",
			"arch.row.lastActivity": "Last activity: {time}",
			"arch.row.lastActivity.unknown": "Last activity: unknown",
			"arch.row.archivedAt": "Archived: {time}",
			"arch.row.archivedAt.unknown": "Archived: unknown",
			"arch.row.size": "Size: {size}",
			"arch.row.children": "{n} sub-sessions",
			"arch.row.created": "Created {time}",
			"arch.status.running": "Running",
			"arch.status.blank": "Blank",
			"arch.status.archived": "Archived",
			"arch.status.active": "Normal",
			"arch.status.subagent": "Sub-session",
			"arch.issue.no-title": "Missing title",
			"arch.issue.no-archive-time": "Archive time unknown",
			"arch.issue.unreadable": "Incomplete metadata",
			"arch.issue.no-data": "No session data",
			"arch.op.archive": "Archive",
			"arch.op.unarchive": "Unarchive",
			"arch.op.delete": "Delete",
			"arch.op.preview": "Preview",
			"arch.select.all": "Select all results",
			"arch.select.clear": "Clear selection",
			"arch.select.selected": "{n} selected",
			"arch.select.holdNote": "{selected} selected; {outside} are outside the current filter and will still be included",
			"arch.batch.archive": "Archive selected",
			"arch.batch.unarchive": "Unarchive selected",
			"arch.batch.delete": "Delete selected",
			"arch.confirm.deleteTitle": "Delete sessions",
			"arch.confirm.direct": "Directly selected: {n} sessions",
			"arch.confirm.descendants": "Also deleted via parent-child relation: {n} sessions",
			"arch.confirm.total": "Total sessions to delete: {n}",
			"arch.confirm.skipped": "Protected sessions to skip: {n}",
			"arch.confirm.freed": "Estimated space freed: {size}",
			"arch.confirm.irrecoverable": "Physical deletion is not recoverable. Session content will be permanently lost.",
			"arch.confirm.strongCheck": "I understand this action cannot be undone",
			"arch.confirm.confirm": "Delete permanently",
			"arch.confirm.cancel": "Cancel",
			"arch.batch.title.archive": "Batch archive",
			"arch.batch.title.unarchive": "Batch unarchive",
			"arch.batch.title.delete": "Batch delete",
			"arch.batch.progress": "Progress: {processed} / {total}",
			"arch.batch.ok": "Succeeded: {n}",
			"arch.batch.skipped": "Skipped: {n}",
			"arch.batch.failed": "Failed: {n}",
			"arch.batch.freed": "Space freed: {size}",
			"arch.batch.running": "Processing…",
			"arch.batch.finished": "Finished",
			"arch.batch.skipSummary": "Skipped detail: {summary}",
			"arch.batch.withError": "Finished (some requests failed)",
			"arch.batch.retryFailed": "Retry failed only",
			"arch.batch.reason": "Reason",
			"arch.reason.running": "Session is running",
			"arch.reason.attached": "Session is still held open by the DSH process; restart the service or close the session before deleting",
			"arch.reason.current": "Session is currently open",
			"arch.reason.in-flight": "Session is being processed by another operation",
			"arch.reason.not-found": "Session not found",
			"arch.reason.already-archived": "Session already archived",
			"arch.reason.not-archived": "Session is not archived",
			"arch.reason.family-protected": "Family contains a protected member; the whole family was skipped",
			"arch.reason.unreadable": "Session data unreadable",
			"arch.reason.missing-seam": "Not supported by the current SDK environment",
			"arch.reason.busy": "Another operation is in progress",
			"arch.reason.error": "Operation failed",
			"arch.preview.title": "Session preview",
			"arch.preview.messages": "{n} messages in total",
			"arch.preview.empty": "No conversation content to show",
			"arch.preview.loadError": "Preview failed: {error}",
			"arch.preview.basic": "Basic info",
			"arch.preview.excerpt": "Conversation excerpt (first messages)",
			"arch.auto.title": "Automatic maintenance",
			"arch.auto.defaultOff": "Auto-archive and auto-delete are off by default; nothing changes until you enable them.",
			"arch.auto.archiveToggle": "Auto-archive sessions inactive beyond the threshold",
			"arch.auto.archiveDays": "Inactivity threshold (days)",
			"arch.auto.deleteToggle": "Auto-delete archived sessions past their retention",
			"arch.auto.deleteDays": "Archive retention (days)",
			"arch.auto.days.unit": "days",
			"arch.auto.invalidDays": "Days must be an integer between {min} and {max}",
			"arch.auto.preview": "Preview with current settings",
			"arch.auto.preview.loading": "Counting…",
			"arch.auto.preview.archive": "Would auto-archive: {n} sessions",
			"arch.auto.preview.delete": "Would auto-delete: {n} sessions, freeing {size}",
			"arch.auto.preview.none": "Nothing to process with the current settings",
			"arch.auto.runArchive": "Run an archive check now",
			"arch.auto.runDelete": "Run a cleanup check now",
			"arch.auto.lastArchive": "Last auto-archive: {time}, total {total} (ok {ok} / skipped {skipped} / failed {failed})",
			"arch.auto.lastDelete": "Last auto-cleanup: {time}, total {total} (ok {ok} / skipped {skipped} / failed {failed})",
			"arch.auto.nextRun": "Next scheduled check: {time}",
			"arch.auto.neverRun": "Never run",
			"arch.auto.basis": "How it counts: auto-archive uses the session last-activity time (not creation time); auto-delete uses the recorded archive time (not file times). Historical archives with unknown archive time are never auto-deleted; restoring and re-archiving restarts the retention clock. Running sessions, the session you are viewing, and sessions with running children are always protected.",
			"arch.auto.cycleRunning": "An automatic check is running…",
			"arch.auto.saveFailed": "Save failed: the Host did not accept the setting; please retry",
			"arch.auto.runError": "Run failed: {error}",
			"arch.time.unknown": "unknown",
			"arch.current.badge": "current"
		};
		/**
		* Unwired fallback dictionary, picked by the document language at call time.
		* A zh/en-only pick, so it can only ever answer the two languages this
		* package ships: it stays in force exactly while the locale service seat
		* below is unwired.
		*/
		function dictionary() {
			return (typeof document !== "undefined" ? document.documentElement.lang : "zh").toLowerCase().startsWith("en") ? en : zh;
		}
		/**
		* Locale-service translate seat, wired by the browser apply() through
		* ctx.locale.bind(NS) (setRuntimeTranslate). The bound function resolves the
		* ACTIVE language at call time, so every card surface reads the dictionary
		* the host currently serves: this package's zh/en plus any language a pack
		* registers for this namespace (dsh-i18n's ru), walked along that language's
		* declared fallback chain. Reading the document language instead sent every
		* non-en language into the zh branch, which left the card body Chinese while
		* the nav label of the same namespace localized correctly.
		*
		* Undefined until wired, so the document-language fallback above stays in
		* force when the locale service is absent or a caller runs before the
		* plugin mounts.
		*/
		let runtimeT;
		/**
		* Wire the locale-service translate seat; pass undefined to restore the
		* document-language fallback.
		*/
		function setRuntimeTranslate(translate) {
			runtimeT = translate;
		}
		/**
		* Translate a key with optional `{name}` template params in the active
		* language; a missing key degrades to the key itself.
		*/
		function t(key, params) {
			if (runtimeT !== void 0) return runtimeT(key, params);
			let text = dictionary()[key] ?? key;
			if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-session-archive-fish/src/client/archive.module.css.mjs
		const css = "._8WvOUG_root{color:var(--dsw-alias-label-primary,#1f2328);flex-direction:column;gap:12px;font-size:13px;line-height:1.5;display:flex}._8WvOUG_root input[type=checkbox]{accent-color:var(--dsw-alias-button-primary-fill,#4a6cf7)}._8WvOUG_header{justify-content:space-between;align-items:center;gap:8px;display:flex}._8WvOUG_headerTitle{align-items:baseline;gap:10px;min-width:0;display:flex}._8WvOUG_title{font-size:15px;font-weight:600}._8WvOUG_count{color:var(--dsw-alias-label-secondary,#57606a);font-size:12px}._8WvOUG_button{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);cursor:pointer;border-radius:8px;padding:4px 12px;transition:background-color .14s,border-color .14s,color .14s}._8WvOUG_button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#0000000d)}._8WvOUG_button:disabled{opacity:.45;cursor:default}._8WvOUG_dangerButton{background:var(--dsw-alias-state-error-primary,#d64545);color:var(--dsw-alias-label-primary-inverted,#fff);cursor:pointer;border:1px solid #0000;border-radius:8px;padding:4px 12px;transition:filter .14s}._8WvOUG_dangerButton:hover:not(:disabled){filter:brightness(1.08)}._8WvOUG_dangerButton:disabled{opacity:.45;cursor:default}._8WvOUG_linkButton{color:var(--dsw-alias-label-primary-bluish,var(--dsw-alias-button-primary-fill,#4a6cf7));cursor:pointer;background:0 0;border:0;border-radius:6px;padding:3px 8px;font-size:12px;transition:background-color .14s}._8WvOUG_linkButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#0000000d)}._8WvOUG_linkButton:disabled{opacity:.45;cursor:default}._8WvOUG_linkDanger{color:var(--dsw-alias-state-error-primary,#d64545)}._8WvOUG_linkDanger:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 10%, transparent)}._8WvOUG_errorBanner{border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 30%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 8%, transparent);color:var(--dsw-alias-state-error-primary,#d64545);border-radius:8px;align-items:center;gap:8px;padding:8px 12px;display:flex}._8WvOUG_toolbar{flex-wrap:wrap;align-items:center;gap:8px;display:flex}._8WvOUG_tabs{background:color-mix(in srgb, var(--dsw-alias-label-primary,#1f2328) 6%, transparent);border-radius:8px;gap:2px;padding:2px;display:inline-flex}._8WvOUG_tab{color:var(--dsw-alias-label-secondary,#57606a);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:3px 12px;transition:background-color .14s,color .14s,box-shadow .14s}._8WvOUG_tab:hover{color:var(--dsw-alias-label-primary,#1f2328)}._8WvOUG_tabActive{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);box-shadow:var(--dsw-shadow-lv1,0 1px 3px #0000001f);font-weight:600}._8WvOUG_selectWrap{display:inline-flex;position:relative}._8WvOUG_select{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-1,#fff);min-width:128px;color:var(--dsw-alias-label-primary,#1f2328);cursor:pointer;text-align:left;border-radius:8px;justify-content:space-between;align-items:center;gap:8px;padding:4px 10px;transition:border-color .14s;display:inline-flex}._8WvOUG_select:hover{border-color:color-mix(in srgb, var(--dsw-alias-label-primary,#1f2328) 28%, transparent)}._8WvOUG_selectValue{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}._8WvOUG_selectChevron{color:var(--dsw-alias-label-tertiary,#8c959f);flex:none;transition:transform .14s}._8WvOUG_selectChevronOpen{transform:rotate(180deg)}._8WvOUG_popup{z-index:30;border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-overlay,#fff);backdrop-filter:blur(20px)saturate(160%);min-width:100%;box-shadow:var(--dsw-shadow-lv3,0 16px 48px #00000038);border-radius:10px;max-height:280px;padding:4px;animation:.12s _8WvOUG_popupIn;position:absolute;top:calc(100% + 4px);left:0;overflow:auto}._8WvOUG_groupLabel{color:var(--dsw-alias-label-tertiary,#8c959f);white-space:nowrap;padding:6px 10px 2px;font-size:11px;font-weight:600}._8WvOUG_option{cursor:pointer;white-space:nowrap;color:var(--dsw-alias-label-primary,#1f2328);border-radius:6px;justify-content:space-between;align-items:center;gap:10px;padding:5px 10px;display:flex}._8WvOUG_optionActive{background:var(--dsw-alias-interactive-bg-hover,#0000000d)}._8WvOUG_optionCheck{color:var(--dsw-alias-button-primary-fill,#4a6cf7);flex:none}@keyframes _8WvOUG_popupIn{0%{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}._8WvOUG_search{flex:160px;min-width:140px}._8WvOUG_search::placeholder{color:var(--dsw-alias-label-tertiary,#8c959f)}._8WvOUG_checkLabel{cursor:pointer;align-items:center;gap:5px;display:inline-flex}._8WvOUG_selectionBar{border:1px solid var(--dsw-alias-border-l1,#e1e5ea);background:var(--dsw-alias-bg-layer-2,#f2f4f7);border-radius:10px;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;display:flex}._8WvOUG_selectedCount{font-weight:600}._8WvOUG_batchActions{gap:8px;margin-left:auto;display:inline-flex}._8WvOUG_holdNote{color:var(--dsw-alias-state-warn-primary,#b45309);font-size:12px}._8WvOUG_list{border:1px solid var(--dsw-alias-border-l1,#e1e5ea);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:var(--dsw-shadow-lv1,0 1px 3px #00000014);border-radius:10px;flex-direction:column;display:flex;overflow:hidden}._8WvOUG_empty{text-align:center;color:var(--dsw-alias-label-tertiary,#8c959f);padding:36px 24px}._8WvOUG_row{border-bottom:1px solid var(--dsw-alias-border-l1,#e1e5ea);align-items:flex-start;gap:10px;padding:10px 12px;transition:background-color .14s;display:flex}._8WvOUG_row:last-child{border-bottom:0}._8WvOUG_row:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000a)}._8WvOUG_rowSelected{background:color-mix(in srgb, var(--dsw-alias-button-primary-fill,#4a6cf7) 10%, transparent);box-shadow:inset 3px 0 0 0 var(--dsw-alias-button-primary-fill,#4a6cf7)}._8WvOUG_rowSelected:hover{background:color-mix(in srgb, var(--dsw-alias-button-primary-fill,#4a6cf7) 14%, transparent)}._8WvOUG_rowMain{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}._8WvOUG_rowTitleLine{flex-wrap:wrap;align-items:center;gap:6px;display:flex}._8WvOUG_rowTitle{overflow-wrap:anywhere;font-weight:600}._8WvOUG_rowMeta{color:var(--dsw-alias-label-secondary,#57606a);flex-wrap:wrap;gap:4px 12px;font-size:12px;display:flex}._8WvOUG_rowId{background:color-mix(in srgb, var(--dsw-alias-label-primary,#1f2328) 7%, transparent);overflow-wrap:anywhere;border-radius:4px;padding:0 5px;font-family:ui-monospace,monospace;font-size:11px}._8WvOUG_rowActions{white-space:nowrap;flex-direction:row;align-items:center;gap:2px;display:flex}._8WvOUG_chip{white-space:nowrap;border:1px solid #0000;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500}._8WvOUG_chipSuccess{color:var(--dsw-alias-state-success-primary,#2f9e6e);background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#2f9e6e) 12%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary,#2f9e6e) 24%, transparent)}._8WvOUG_chipWarn{color:var(--dsw-alias-state-warn-primary,#b45309);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary,#b45309) 12%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary,#b45309) 24%, transparent)}._8WvOUG_chipDanger{color:var(--dsw-alias-state-error-primary,#d64545);background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 10%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 26%, transparent)}._8WvOUG_chipBusiness{color:var(--dsw-alias-state-business-primary,#4a5fa8);background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4a5fa8) 10%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4a5fa8) 22%, transparent)}._8WvOUG_chipNeutral{color:var(--dsw-alias-label-secondary,#57606a);background:color-mix(in srgb, var(--dsw-alias-label-primary,#1f2328) 6%, transparent)}._8WvOUG_issueText{color:var(--dsw-alias-state-error-primary,#d64545)}._8WvOUG_muted{color:var(--dsw-alias-label-secondary,#57606a)}._8WvOUG_failText{color:var(--dsw-alias-state-error-primary,#d64545)}._8WvOUG_moreRow{justify-content:center;align-items:center;gap:10px;padding:10px;display:flex}._8WvOUG_overlay{background:var(--dsw-alias-bg-mask-1,#0f121980);backdrop-filter:var(--dsw-mask-blur,blur(10px));z-index:1000;justify-content:center;align-items:center;padding:16px;animation:.16s _8WvOUG_overlayIn;display:flex;position:fixed;inset:0}._8WvOUG_modal{box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2328);border:1px solid var(--dsw-alias-border-l2,#d0d7de);width:min(560px,94vw);max-height:min(82vh,100% - 32px);box-shadow:var(--dsw-shadow-lv3,0 16px 48px #00000038);border-radius:14px;outline:none;flex-direction:column;gap:12px;padding:18px 20px;animation:.18s _8WvOUG_modalIn;display:flex;overflow:hidden}._8WvOUG_modalDanger{border-top:3px solid var(--dsw-alias-state-error-primary,#d64545);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 40%, transparent)}._8WvOUG_modalWide{width:min(680px,94vw)}._8WvOUG_modalTitle{flex:none;font-size:15px;font-weight:600}._8WvOUG_modalDanger ._8WvOUG_modalTitle{color:var(--dsw-alias-state-error-primary,#d64545)}._8WvOUG_modalActions{flex:none;justify-content:flex-end;gap:8px;margin-top:auto;display:flex}@keyframes _8WvOUG_overlayIn{0%{opacity:0}to{opacity:1}}@keyframes _8WvOUG_modalIn{0%{opacity:0;transform:translateY(8px)scale(.98)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){._8WvOUG_overlay,._8WvOUG_modal,._8WvOUG_popup{animation:none}._8WvOUG_button,._8WvOUG_tab,._8WvOUG_linkButton,._8WvOUG_row,._8WvOUG_select,._8WvOUG_selectChevron{transition:none}}._8WvOUG_confirmBody{flex-direction:column;flex:auto;gap:5px;min-height:0;display:flex;overflow-y:auto}._8WvOUG_confirmLine{color:var(--dsw-alias-label-secondary,#57606a)}._8WvOUG_confirmTotal{color:var(--dsw-alias-state-error-primary,#d64545);padding:3px 0;font-size:14px;font-weight:700}._8WvOUG_dangerCallout{border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 26%, transparent);border-left:3px solid var(--dsw-alias-state-error-primary,#d64545);background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 7%, transparent);color:var(--dsw-alias-state-error-primary,#d64545);border-radius:8px;margin-top:4px;padding:9px 12px;font-weight:600}._8WvOUG_ackRow{border:1px dashed color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 40%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#d64545) 5%, transparent);cursor:pointer;border-radius:8px;align-items:center;gap:8px;margin-top:4px;padding:8px 10px;display:flex}._8WvOUG_batchBody{flex-direction:column;flex:auto;gap:8px;min-height:0;display:flex;overflow-y:auto}._8WvOUG_progressBar{background:color-mix(in srgb, var(--dsw-alias-label-primary,#1f2328) 10%, transparent);border-radius:999px;height:8px;overflow:hidden}._8WvOUG_progressFill{border-radius:inherit;background:var(--dsw-alias-button-primary-fill,#4a6cf7);height:100%;transition:width .2s}._8WvOUG_progressFillDanger{background:var(--dsw-alias-state-error-primary,#d64545)}._8WvOUG_batchStats{color:var(--dsw-alias-label-secondary,#57606a);flex-wrap:wrap;gap:4px 14px;font-size:12px;display:flex}._8WvOUG_batchList{border:1px solid var(--dsw-alias-border-l1,#e1e5ea);border-radius:8px;flex-direction:column;gap:4px;max-height:200px;margin:0;padding:8px 12px;font-size:12px;list-style:none;display:flex;overflow:auto}._8WvOUG_batchList li{align-items:baseline;gap:8px;display:flex}._8WvOUG_previewBody{flex-direction:column;flex:auto;gap:8px;min-height:0;display:flex;overflow-y:auto}._8WvOUG_previewMeta{color:var(--dsw-alias-label-secondary,#57606a);flex-direction:column;gap:4px;font-size:12px;display:flex}._8WvOUG_previewSection{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600}._8WvOUG_previewList{flex-direction:column;gap:6px;max-height:280px;margin:0;padding:0;list-style:none;display:flex;overflow:auto}._8WvOUG_previewList li{overflow-wrap:anywhere;border-radius:8px;gap:8px;padding:8px 10px;display:flex}._8WvOUG_previewUser{background:color-mix(in srgb, var(--dsw-alias-button-primary-fill,#4a6cf7) 9%, transparent)}._8WvOUG_previewAssistant{background:color-mix(in srgb, var(--dsw-alias-label-primary,#1f2328) 4%, transparent)}._8WvOUG_previewRole{text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-secondary,#57606a);flex:none;padding-top:2px;font-size:10px;font-weight:700}._8WvOUG_previewUser ._8WvOUG_previewRole{color:var(--dsw-alias-button-primary-fill,#4a6cf7)}._8WvOUG_autoPanel{border:1px solid var(--dsw-alias-border-l1,#e1e5ea);background:var(--dsw-alias-bg-layer-2,#f2f4f7);border-radius:10px;flex-direction:column;gap:8px;padding:12px 14px;display:flex}._8WvOUG_autoTitle{font-weight:600}._8WvOUG_autoRow{flex-wrap:wrap;align-items:center;gap:12px;display:flex}._8WvOUG_autoActions{flex-wrap:wrap;gap:8px;display:flex}._8WvOUG_daysRow{align-items:center;gap:6px;display:inline-flex}._8WvOUG_daysInput{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-1,#fff);width:76px;color:var(--dsw-alias-label-primary,#1f2328);border-radius:8px;padding:3px 8px;transition:border-color .14s}._8WvOUG_inputInvalid{border-color:var(--dsw-alias-state-error-primary,#d64545)}._8WvOUG_autoPreviewBox{border:1px solid var(--dsw-alias-border-l1,#e1e5ea);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:8px;flex-direction:column;gap:4px;padding:10px 12px;display:flex}._8WvOUG_autoStats{color:var(--dsw-alias-label-secondary,#57606a);flex-direction:column;gap:3px;font-size:12px;display:flex}._8WvOUG_autoBasis{color:var(--dsw-alias-label-secondary,#57606a);border-top:1px solid var(--dsw-alias-border-l1,#e1e5ea);padding-top:8px;font-size:12px;line-height:1.6}._8WvOUG_button:focus-visible,._8WvOUG_dangerButton:focus-visible,._8WvOUG_linkButton:focus-visible,._8WvOUG_tab:focus-visible,._8WvOUG_select:focus-visible,._8WvOUG_search:focus-visible,._8WvOUG_daysInput:focus-visible{outline:2px solid color-mix(in srgb, var(--dsw-alias-button-primary-fill,#4a6cf7) 60%, transparent);outline-offset:1px}@media (width<=640px){._8WvOUG_batchActions{width:100%;margin-left:0}}";
		const tagId = "@fish-under-sea/dsh-session-archive-fish/packages/dsh-session-archive-fish/src/client/archive.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@fish-under-sea/dsh-session-archive-fish";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var archive_module_css_default = {
			"ackRow": "_8WvOUG_ackRow",
			"autoActions": "_8WvOUG_autoActions",
			"autoBasis": "_8WvOUG_autoBasis",
			"autoPanel": "_8WvOUG_autoPanel",
			"autoPreviewBox": "_8WvOUG_autoPreviewBox",
			"autoRow": "_8WvOUG_autoRow",
			"autoStats": "_8WvOUG_autoStats",
			"autoTitle": "_8WvOUG_autoTitle",
			"batchActions": "_8WvOUG_batchActions",
			"batchBody": "_8WvOUG_batchBody",
			"batchList": "_8WvOUG_batchList",
			"batchStats": "_8WvOUG_batchStats",
			"button": "_8WvOUG_button",
			"checkLabel": "_8WvOUG_checkLabel",
			"chip": "_8WvOUG_chip",
			"chipBusiness": "_8WvOUG_chipBusiness",
			"chipDanger": "_8WvOUG_chipDanger",
			"chipNeutral": "_8WvOUG_chipNeutral",
			"chipSuccess": "_8WvOUG_chipSuccess",
			"chipWarn": "_8WvOUG_chipWarn",
			"confirmBody": "_8WvOUG_confirmBody",
			"confirmLine": "_8WvOUG_confirmLine",
			"confirmTotal": "_8WvOUG_confirmTotal",
			"count": "_8WvOUG_count",
			"dangerButton": "_8WvOUG_dangerButton",
			"dangerCallout": "_8WvOUG_dangerCallout",
			"daysInput": "_8WvOUG_daysInput",
			"daysRow": "_8WvOUG_daysRow",
			"empty": "_8WvOUG_empty",
			"errorBanner": "_8WvOUG_errorBanner",
			"failText": "_8WvOUG_failText",
			"groupLabel": "_8WvOUG_groupLabel",
			"header": "_8WvOUG_header",
			"headerTitle": "_8WvOUG_headerTitle",
			"holdNote": "_8WvOUG_holdNote",
			"inputInvalid": "_8WvOUG_inputInvalid",
			"issueText": "_8WvOUG_issueText",
			"linkButton": "_8WvOUG_linkButton",
			"linkDanger": "_8WvOUG_linkDanger",
			"list": "_8WvOUG_list",
			"modal": "_8WvOUG_modal",
			"modalActions": "_8WvOUG_modalActions",
			"modalDanger": "_8WvOUG_modalDanger",
			"modalIn": "_8WvOUG_modalIn",
			"modalTitle": "_8WvOUG_modalTitle",
			"modalWide": "_8WvOUG_modalWide",
			"moreRow": "_8WvOUG_moreRow",
			"muted": "_8WvOUG_muted",
			"option": "_8WvOUG_option",
			"optionActive": "_8WvOUG_optionActive",
			"optionCheck": "_8WvOUG_optionCheck",
			"overlay": "_8WvOUG_overlay",
			"overlayIn": "_8WvOUG_overlayIn",
			"popup": "_8WvOUG_popup",
			"popupIn": "_8WvOUG_popupIn",
			"previewAssistant": "_8WvOUG_previewAssistant",
			"previewBody": "_8WvOUG_previewBody",
			"previewList": "_8WvOUG_previewList",
			"previewMeta": "_8WvOUG_previewMeta",
			"previewRole": "_8WvOUG_previewRole",
			"previewSection": "_8WvOUG_previewSection",
			"previewUser": "_8WvOUG_previewUser",
			"progressBar": "_8WvOUG_progressBar",
			"progressFill": "_8WvOUG_progressFill",
			"progressFillDanger": "_8WvOUG_progressFillDanger",
			"root": "_8WvOUG_root",
			"row": "_8WvOUG_row",
			"rowActions": "_8WvOUG_rowActions",
			"rowId": "_8WvOUG_rowId",
			"rowMain": "_8WvOUG_rowMain",
			"rowMeta": "_8WvOUG_rowMeta",
			"rowSelected": "_8WvOUG_rowSelected",
			"rowTitle": "_8WvOUG_rowTitle",
			"rowTitleLine": "_8WvOUG_rowTitleLine",
			"search": "_8WvOUG_search",
			"select": "_8WvOUG_select",
			"selectChevron": "_8WvOUG_selectChevron",
			"selectChevronOpen": "_8WvOUG_selectChevronOpen",
			"selectValue": "_8WvOUG_selectValue",
			"selectWrap": "_8WvOUG_selectWrap",
			"selectedCount": "_8WvOUG_selectedCount",
			"selectionBar": "_8WvOUG_selectionBar",
			"tab": "_8WvOUG_tab",
			"tabActive": "_8WvOUG_tabActive",
			"tabs": "_8WvOUG_tabs",
			"title": "_8WvOUG_title",
			"toolbar": "_8WvOUG_toolbar"
		};
		//#endregion
		//#region src/client/dialogs.tsx
		/**
		* Dialog surfaces for the session-archive section: the physical-delete
		* confirmation (with family cascade accounting and a strong second
		* confirmation for large deletes), the live batch progress, and the
		* session preview. All dialogs are keyboard-accessible (Esc closes, focus
		* moves in on open and back on close) and render with role=dialog.
		* @module @fish-under-sea/dsh-session-archive-fish/client/dialogs
		*/
		/** Human-readable byte size. */
		function formatBytes(bytes) {
			if (bytes === void 0 || !Number.isFinite(bytes) || bytes <= 0) return "0 B";
			const units = [
				"B",
				"KB",
				"MB",
				"GB",
				"TB"
			];
			let value = bytes;
			let unit = 0;
			while (value >= 1024 && unit < units.length - 1) {
				value /= 1024;
				unit += 1;
			}
			return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
		}
		function formatTime(ms) {
			if (ms === void 0 || !Number.isFinite(ms)) return t("arch.time.unknown");
			try {
				return new Date(ms).toLocaleString();
			} catch {
				return String(ms);
			}
		}
		/** Shared modal shell: focus on open, Esc to close, restore focus after. */
		function Modal({ title, onClose, children, danger, wide }) {
			const ref = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				ref.current?.focus();
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						event.stopImmediatePropagation?.();
						onClose();
					}
				};
				document.addEventListener("keydown", onKey, { capture: true });
				return () => {
					document.removeEventListener("keydown", onKey, { capture: true });
					previous?.focus();
				};
			}, [onClose]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: archive_module_css_default.overlay,
				role: "presentation",
				onMouseDown: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": title,
					tabIndex: -1,
					className: `${archive_module_css_default.modal} ${danger === true ? archive_module_css_default.modalDanger : ""} ${wide === true ? archive_module_css_default.modalWide : ""}`,
					"data-dsh-part": "dialog",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: archive_module_css_default.modalTitle,
						children: title
					}), children]
				})
			});
		}
		/** Delete confirmation with full cascade accounting. */
		function DeleteConfirmDialog(props) {
			const [acknowledged, setAcknowledged] = (0, react.useState)(false);
			const needCheck = props.state.strong;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
				title: t("arch.confirm.deleteTitle"),
				onClose: props.onCancel,
				danger: true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: archive_module_css_default.confirmBody,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.confirmLine,
							children: t("arch.confirm.direct", { n: props.state.ids.length })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.confirmLine,
							children: t("arch.confirm.descendants", { n: props.state.descendants })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.confirmTotal,
							children: t("arch.confirm.total", { n: props.state.total })
						}),
						props.state.skippedProtected > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.muted,
							children: t("arch.confirm.skipped", { n: props.state.skippedProtected })
						}),
						props.state.totalBytes > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.muted,
							children: t("arch.confirm.freed", { size: formatBytes(props.state.totalBytes) })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.dangerCallout,
							children: t("arch.confirm.irrecoverable")
						}),
						needCheck && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: archive_module_css_default.ackRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: acknowledged,
								onChange: (event) => {
									setAcknowledged(event.target.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.confirm.strongCheck") })]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: archive_module_css_default.modalActions,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: archive_module_css_default.button,
						onClick: props.onCancel,
						children: t("arch.confirm.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: archive_module_css_default.dangerButton,
						disabled: needCheck && !acknowledged,
						onClick: props.onConfirm,
						children: t("arch.confirm.confirm")
					})]
				})]
			});
		}
		/** Live batch progress with per-session skip/fail reasons. */
		function BatchDialog(props) {
			const { batch } = props;
			const failed = batch.results.filter((result) => result.status === "failed");
			const skipped = batch.results.filter((result) => result.status === "skipped");
			const ok = batch.results.filter((result) => result.status === "ok");
			const reasonText = (result) => {
				const base = result.reason === void 0 ? t("arch.reason.error") : t(`arch.reason.${result.reason}`);
				return result.detail === void 0 ? base : `${base} (${result.detail})`;
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
				title: t(`arch.batch.title.${batch.kind}`),
				onClose: batch.running ? () => {} : props.onClose,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: archive_module_css_default.batchBody,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("arch.batch.progress", {
							processed: batch.processed,
							total: batch.total
						}) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.progressBar,
							role: "progressbar",
							"aria-valuenow": batch.processed,
							"aria-valuemax": batch.total,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: `${archive_module_css_default.progressFill} ${batch.kind === "delete" ? archive_module_css_default.progressFillDanger : ""}`,
								style: { width: batch.total === 0 ? "100%" : `${Math.min(100, Math.round(batch.processed / batch.total * 100))}%` }
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: archive_module_css_default.batchStats,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: batch.running ? t("arch.batch.running") : batch.error !== null ? t("arch.batch.withError") : t("arch.batch.finished") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.batch.ok", { n: ok.length }) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.batch.skipped", { n: skipped.length }) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.batch.failed", { n: failed.length }) }),
								batch.freedBytes > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.batch.freed", { size: formatBytes(batch.freedBytes) }) })
							]
						}),
						!batch.running && skipped.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.muted,
							children: t("arch.batch.skipSummary", { summary: Object.entries(skipped.reduce((acc, result) => {
								const key = result.reason ?? "error";
								acc[key] = (acc[key] ?? 0) + 1;
								return acc;
							}, {})).map(([reason, n]) => `${t(`arch.reason.${reason}`)} ×${n}`).join(" · ") })
						}),
						!batch.running && failed.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: archive_module_css_default.button,
							onClick: props.onRetryFailed,
							children: t("arch.batch.retryFailed")
						}),
						(failed.length > 0 || skipped.length > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: archive_module_css_default.batchList,
							children: [...failed, ...skipped].slice(0, 60).map((result) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
								className: archive_module_css_default.rowId,
								children: result.id
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: result.status === "failed" ? archive_module_css_default.failText : archive_module_css_default.muted,
								children: reasonText(result)
							})] }, result.id))
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: archive_module_css_default.modalActions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: archive_module_css_default.button,
						disabled: batch.running,
						onClick: props.onClose,
						children: t("arch.close")
					})
				})]
			});
		}
		/** Session preview: basic info + a tolerant conversation excerpt. */
		function PreviewDialog(props) {
			const { preview } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
				title: t("arch.preview.title"),
				onClose: props.onClose,
				wide: true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: archive_module_css_default.previewBody,
					children: [
						preview.status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.muted,
							children: t("arch.loading")
						}),
						preview.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.failText,
							children: t("arch.preview.loadError", { error: preview.error ?? "" })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: archive_module_css_default.button,
							onClick: props.onRetry,
							children: t("arch.retry")
						})] }),
						preview.status === "ready" && preview.data !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: archive_module_css_default.previewMeta,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									className: archive_module_css_default.rowId,
									children: preview.id
								}) }),
								preview.data.title !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: preview.data.title }),
								preview.data.createdAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("arch.row.created", { time: formatTime(preview.data.createdAt) }) }),
								preview.data.cwd !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: archive_module_css_default.muted,
									children: preview.data.cwd
								}),
								preview.data.sizeBytes !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: archive_module_css_default.muted,
									children: t("arch.row.size", { size: formatBytes(preview.data.sizeBytes) })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("arch.preview.messages", { n: preview.data.messageCount }) })
							]
						}), preview.data.excerpt.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.muted,
							children: t("arch.preview.empty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: archive_module_css_default.previewSection,
							children: t("arch.preview.excerpt")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: archive_module_css_default.previewList,
							children: preview.data.excerpt.map((message, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: message.role === "user" ? archive_module_css_default.previewUser : archive_module_css_default.previewAssistant,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: archive_module_css_default.previewRole,
									children: message.role
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: message.text })]
							}, index))
						})] })] })
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: archive_module_css_default.modalActions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: archive_module_css_default.button,
						onClick: props.onClose,
						children: t("arch.close")
					})
				})]
			});
		}
		//#endregion
		//#region src/core/config.ts
		const AUTO_ARCHIVE_DAYS_MAX = 3650;
		const AUTO_DELETE_DAYS_MAX = 3650;
		//#endregion
		//#region src/client/AutoSettings.tsx
		/**
		* The automatic-maintenance settings panel inside the session-archive
		* section: independent auto-archive / auto-delete switches with day
		* thresholds (validated locally before save), candidate previews, manual
		* run-now buttons, and the persisted last-run/next-check status.
		* @module @fish-under-sea/dsh-session-archive-fish/client/AutoSettings
		*/
		/** One validated day-threshold input; invalid values are never saved. */
		function DaysInput(props) {
			const [text, setText] = (0, react.useState)(null);
			const effective = text ?? (props.value === void 0 ? "" : String(props.value));
			const parsed = Number(effective);
			const valid = Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= props.min && parsed <= props.max;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: archive_module_css_default.daysRow,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.label }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "number",
						className: `${archive_module_css_default.daysInput} ${effective !== "" && !valid ? archive_module_css_default.inputInvalid : ""}`,
						value: effective,
						min: props.min,
						max: props.max,
						onChange: (event) => {
							setText(event.target.value);
						},
						onBlur: () => {
							if (effective === "") {
								setText(null);
								return;
							}
							if (valid) {
								props.onSave(parsed);
								setText(null);
							}
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: archive_module_css_default.muted,
						children: t("arch.auto.days.unit")
					}),
					effective !== "" && !valid && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: archive_module_css_default.failText,
						children: t("arch.auto.invalidDays", {
							min: props.min,
							max: props.max
						})
					})
				]
			});
		}
		function AutoSettingsPanel(props) {
			const settings = props.settings;
			const value = (0, react.useSyncExternalStore)((0, react.useMemo)(() => settings.subscribe.bind(settings), [settings]), (0, react.useMemo)(() => settings.getSnapshot.bind(settings), [settings])).value ?? {};
			const ui = (0, react.useSyncExternalStore)(props.controller.store.subscribe, props.controller.store.getSnapshot);
			const autoPreview = ui.autoPreview;
			const autoPreviewLoading = ui.autoPreviewLoading;
			const cycleRunning = props.auto?.cycleRunning === true;
			const [saveFailed, setSaveFailed] = (0, react.useState)(false);
			const write = (field, value) => {
				props.settings.set(field, value).then((accepted) => {
					setSaveFailed(!accepted);
				}, () => {
					setSaveFailed(true);
				});
			};
			const runStatsLine = (stats, key) => {
				if (stats === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: archive_module_css_default.muted,
					children: t("arch.auto.neverRun")
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(key, {
					time: formatTime(stats.at),
					total: stats.total,
					ok: stats.ok,
					skipped: stats.skipped,
					failed: stats.failed
				}) });
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: archive_module_css_default.autoPanel,
				"data-dsh-part": "settings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: archive_module_css_default.autoTitle,
						children: t("arch.auto.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: archive_module_css_default.muted,
						children: t("arch.auto.defaultOff")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.autoRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: archive_module_css_default.checkLabel,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: value.autoArchiveEnabled === true,
								onChange: (event) => {
									write("autoArchiveEnabled", event.target.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.auto.archiveToggle") })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DaysInput, {
							value: value.autoArchiveDays,
							min: 1,
							max: AUTO_ARCHIVE_DAYS_MAX,
							label: t("arch.auto.archiveDays"),
							onSave: (value) => {
								write("autoArchiveDays", value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.autoRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: archive_module_css_default.checkLabel,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: value.autoDeleteEnabled === true,
								onChange: (event) => {
									write("autoDeleteEnabled", event.target.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.auto.deleteToggle") })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DaysInput, {
							value: value.autoDeleteDays,
							min: 1,
							max: AUTO_DELETE_DAYS_MAX,
							label: t("arch.auto.deleteDays"),
							onSave: (value) => {
								write("autoDeleteDays", value);
							}
						})]
					}),
					saveFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: archive_module_css_default.failText,
						role: "status",
						"data-dsh-part": "settings-save-failed",
						children: t("arch.auto.saveFailed")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.autoActions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: archive_module_css_default.button,
								disabled: cycleRunning,
								onClick: () => {
									props.controller.refreshAutoPreview();
								},
								children: autoPreviewLoading === true ? t("arch.auto.preview.loading") : t("arch.auto.preview")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: archive_module_css_default.button,
								disabled: cycleRunning,
								onClick: () => {
									props.controller.runAuto("archive");
								},
								children: t("arch.auto.runArchive")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: archive_module_css_default.dangerButton,
								disabled: cycleRunning,
								onClick: () => {
									props.controller.runAuto("delete");
								},
								children: t("arch.auto.runDelete")
							})
						]
					}),
					cycleRunning && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: archive_module_css_default.muted,
						children: t("arch.auto.cycleRunning")
					}),
					autoPreview !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.autoPreviewBox,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("arch.auto.preview.archive", { n: autoPreview.archiveCandidates.length }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("arch.auto.preview.delete", {
								n: autoPreview.deleteCandidates.length,
								size: formatBytes(autoPreview.deleteBytes)
							}) }),
							autoPreview.archiveCandidates.length === 0 && autoPreview.deleteCandidates.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: archive_module_css_default.muted,
								children: t("arch.auto.preview.none")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.autoStats,
						children: [
							runStatsLine(props.auto?.lastArchiveRun, "arch.auto.lastArchive"),
							runStatsLine(props.auto?.lastDeleteRun, "arch.auto.lastDelete"),
							props.auto?.nextCheckAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: archive_module_css_default.muted,
								children: t("arch.auto.nextRun", { time: formatTime(props.auto.nextCheckAt) })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: archive_module_css_default.autoBasis,
						children: t("arch.auto.basis")
					})
				]
			});
		}
		//#endregion
		//#region src/client/Select.tsx
		/**
		* Themed dropdown select for the section toolbar: a trigger button plus an
		* absolutely positioned listbox popup, replacing the unstyleable native
		* <select>. Keyboard complete (arrows, Home/End, Enter, Esc), closes on
		* outside pointer down, optional group headers render non-selectable.
		* @module @fish-under-sea/dsh-session-archive-fish/client/Select
		*/
		/** Grouped view of the option list preserving first-appearance group order. */
		function groupOptions(options) {
			const groups = [];
			options.forEach((option, index) => {
				const name = option.group ?? "";
				let group = groups.find((candidate) => candidate.name === name);
				if (group === void 0) {
					group = {
						name,
						items: []
					};
					groups.push(group);
				}
				group.items.push({
					option,
					index
				});
			});
			return groups;
		}
		function Select(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const [active, setActive] = (0, react.useState)(0);
			const rootRef = (0, react.useRef)(null);
			const listRef = (0, react.useRef)(null);
			const activeIndex = (open) => {
				if (!open) return 0;
				const index = props.options.findIndex((option) => option.value === props.value);
				return index === -1 ? 0 : index;
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					if (rootRef.current !== null && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
				};
			}, [open]);
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				listRef.current?.querySelector("[data-active=\"true\"]")?.scrollIntoView({ block: "nearest" });
			}, [open, active]);
			const select = (index) => {
				setOpen(false);
				props.onChange(props.options[index].value);
			};
			const onKeyDown = (event) => {
				if (!open) {
					if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						setActive(activeIndex(true));
						setOpen(true);
					}
					return;
				}
				if (event.key === "ArrowDown") {
					event.preventDefault();
					setActive((current) => Math.min(props.options.length - 1, current + 1));
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					setActive((current) => Math.max(0, current - 1));
				} else if (event.key === "Home") {
					event.preventDefault();
					setActive(0);
				} else if (event.key === "End") {
					event.preventDefault();
					setActive(props.options.length - 1);
				} else if (event.key === "Enter") {
					event.preventDefault();
					select(active);
				} else if (event.key === "Escape") {
					event.preventDefault();
					setOpen(false);
				}
			};
			const selectedOption = props.options.find((option) => option.value === props.value);
			const groups = groupOptions(props.options);
			const grouped = groups.some((group) => group.name !== "");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: archive_module_css_default.selectWrap,
				onKeyDown,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: archive_module_css_default.select,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-label": props.ariaLabel,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: archive_module_css_default.selectValue,
						children: selectedOption?.label ?? props.options[0]?.label ?? ""
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: `${archive_module_css_default.selectChevron} ${open ? archive_module_css_default.selectChevronOpen : ""}`,
						viewBox: "0 0 12 12",
						width: "10",
						height: "10",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M2 4l4 4 4-4",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.6",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: listRef,
					className: archive_module_css_default.popup,
					role: "listbox",
					"aria-label": props.ariaLabel,
					"aria-activedescendant": `arch-select-opt-${active}`,
					children: groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [grouped && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: archive_module_css_default.groupLabel,
						children: group.name
					}), group.items.map(({ option, index }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						id: `arch-select-opt-${index}`,
						role: "option",
						"aria-selected": option.value === props.value,
						"data-active": index === active || void 0,
						className: `${archive_module_css_default.option} ${index === active ? archive_module_css_default.optionActive : ""}`,
						onMouseDown: (event) => {
							event.preventDefault();
						},
						onClick: () => {
							select(index);
						},
						onMouseMove: () => {
							setActive(index);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: option.label }), option.value === props.value && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							className: archive_module_css_default.optionCheck,
							viewBox: "0 0 12 12",
							width: "12",
							height: "12",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M2 6.5l2.6 2.6L10 3.5",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.8",
								strokeLinecap: "round",
								strokeLinejoin: "round"
							})
						})]
					}, option.value))] }, group.name))
				})]
			});
		}
		//#endregion
		//#region src/client/SessionArchiveCard.tsx
		/**
		* The 会话归档管理 first-level settings section: full inventory list with
		* filters/search/sort, cross-result multi-select, batch archive/unarchive/
		* physical delete with progress and per-session reasons, session preview,
		* and the automatic-maintenance settings panel.
		* @module @fish-under-sea/dsh-session-archive-fish/client/SessionArchiveCard
		*/
		/** Row status chips: the conjunction of running/blank/archived facts. */
		function statusChips(row, currentId) {
			const chips = [];
			if (row.running) chips.push({
				key: "running",
				label: t("arch.status.running"),
				tone: archive_module_css_default.chipWarn
			});
			else if (row.blank) chips.push({
				key: "blank",
				label: t("arch.status.blank"),
				tone: archive_module_css_default.chipNeutral
			});
			else chips.push({
				key: "active",
				label: t("arch.status.active"),
				tone: archive_module_css_default.chipSuccess
			});
			if (row.archived) chips.push({
				key: "archived",
				label: t("arch.status.archived"),
				tone: archive_module_css_default.chipBusiness
			});
			if (row.origin === "subagent") chips.push({
				key: "subagent",
				label: t("arch.status.subagent"),
				tone: archive_module_css_default.chipNeutral
			});
			if (currentId !== void 0 && row.id === currentId) chips.push({
				key: "current",
				label: t("arch.current.badge"),
				tone: archive_module_css_default.chipDanger
			});
			return chips;
		}
		function issueLabels(row) {
			return row.issues.map((issue) => t(`arch.issue.${issue}`));
		}
		function SessionArchiveCard(props) {
			const { controller } = props;
			const ui = (0, react.useSyncExternalStore)(controller.store.subscribe, controller.store.getSnapshot);
			const [currentId, setCurrentId] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				controller.load();
				setCurrentId(controller.getCurrentSessionId());
			}, [controller]);
			const rows = ui.inventory?.rows ?? [];
			const workspaces = ui.inventory?.workspaces ?? [];
			const filtered = (0, react.useMemo)(() => sortRows(filterRows(rows, ui.filter), ui.sortKey, ui.sortDir), [
				rows,
				ui.filter,
				ui.sortKey,
				ui.sortDir
			]);
			const selection = (0, react.useMemo)(() => new Set(ui.selection), [ui.selection]);
			const summary = selectionSummary(selection, filtered);
			const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
			const page = Math.min(ui.page, totalPages - 1);
			const shown = filtered.slice(page * 20, page * 20 + 20);
			const busy = ui.batch !== null && ui.batch.running;
			const workspaceTitle = (id) => workspaces.find((workspace) => workspace.id === id)?.title ?? id;
			const onSelectAll = () => {
				controller.store.actions.selectMany(filtered.map((row) => row.id), true);
			};
			const runBatch = (kind) => {
				controller.runBatch(kind, ui.selection);
			};
			const requestDelete = (ids) => {
				controller.confirmDelete(ids);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: archive_module_css_default.root,
				"data-dsh-plugin": "session-archive",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.header,
						"data-dsh-part": "header",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: archive_module_css_default.headerTitle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: archive_module_css_default.title,
								children: t("arch.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: archive_module_css_default.count,
								children: t("arch.results.count", { n: filtered.length })
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: archive_module_css_default.button,
							disabled: ui.status === "loading",
							onClick: () => {
								controller.load();
							},
							children: ui.status === "loading" ? t("arch.refreshing") : t("arch.refresh")
						})]
					}),
					ui.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.errorBanner,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.error", { error: ui.error ?? "" }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: archive_module_css_default.button,
							onClick: () => {
								controller.load();
							},
							children: t("arch.retry")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.toolbar,
						"data-dsh-part": "toolbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: archive_module_css_default.tabs,
								role: "tablist",
								children: [
									"all",
									"active",
									"archived"
								].map((status) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": ui.filter.status === status,
									className: `${archive_module_css_default.tab} ${ui.filter.status === status ? archive_module_css_default.tabActive : ""}`,
									onClick: () => {
										controller.store.actions.setFilter({ status });
									},
									children: t(`arch.filter.${status}`)
								}, status))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
								value: ui.filter.workspaceId,
								ariaLabel: t("arch.filter.workspace"),
								options: [
									{
										value: "any",
										label: t("arch.filter.workspace.any")
									},
									{
										value: "none",
										label: t("arch.filter.workspace.none")
									},
									...workspaces.map((workspace) => ({
										value: workspace.id,
										label: workspace.title
									}))
								],
								onChange: (value) => {
									controller.store.actions.setFilter({ workspaceId: value });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "search",
								className: archive_module_css_default.search,
								placeholder: t("arch.filter.search"),
								value: ui.filter.query,
								onChange: (event) => {
									controller.store.actions.setFilter({ query: event.target.value });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
								value: `${ui.sortKey}:${ui.sortDir}`,
								ariaLabel: t("arch.sort"),
								options: [
									"lastActivity",
									"archivedAt",
									"createdAt",
									"title",
									"size"
								].flatMap((key) => [{
									value: `${key}:desc`,
									label: t("arch.sort.desc"),
									group: t(`arch.sort.${key}`)
								}, {
									value: `${key}:asc`,
									label: t("arch.sort.asc"),
									group: t(`arch.sort.${key}`)
								}]),
								onChange: (value) => {
									const [key, dir] = value.split(":");
									controller.store.actions.setSort(key, dir);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: archive_module_css_default.checkLabel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: ui.filter.issuesOnly,
									onChange: (event) => {
										controller.store.actions.setFilter({ issuesOnly: event.target.checked });
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.filter.issues") })]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.selectionBar,
						"data-dsh-part": "selection-bar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: archive_module_css_default.button,
								onClick: onSelectAll,
								children: t("arch.select.all")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: archive_module_css_default.button,
								onClick: () => {
									controller.store.actions.clearSelection();
								},
								disabled: selection.size === 0,
								children: t("arch.select.clear")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: archive_module_css_default.selectedCount,
								children: t("arch.select.selected", { n: selection.size })
							}),
							summary.outside > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: archive_module_css_default.holdNote,
								children: t("arch.select.holdNote", {
									selected: summary.selected,
									outside: summary.outside
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: archive_module_css_default.batchActions,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: archive_module_css_default.button,
										disabled: selection.size === 0 || busy,
										onClick: () => {
											runBatch("archive");
										},
										children: t("arch.batch.archive")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: archive_module_css_default.button,
										disabled: selection.size === 0 || busy,
										onClick: () => {
											runBatch("unarchive");
										},
										children: t("arch.batch.unarchive")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: archive_module_css_default.dangerButton,
										disabled: selection.size === 0 || busy,
										onClick: () => {
											requestDelete(ui.selection);
										},
										children: t("arch.batch.delete")
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: archive_module_css_default.list,
						"data-dsh-part": "list",
						children: [
							filtered.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: archive_module_css_default.empty,
								children: t("arch.empty")
							}),
							shown.map((row) => {
								const chips = statusChips(row, currentId);
								const issues = issueLabels(row);
								const selected = selection.has(row.id);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${archive_module_css_default.row} ${selected ? archive_module_css_default.rowSelected : ""}`,
									"data-dsh-part": "row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											"aria-label": row.title ?? row.id,
											checked: selected,
											onChange: (event) => {
												controller.store.actions.toggleRow(row.id, event.target.checked);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: archive_module_css_default.rowMain,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: archive_module_css_default.rowTitleLine,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: archive_module_css_default.rowTitle,
														children: row.title ?? t("arch.row.noTitle")
													}),
													chips.map((chip) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: `${archive_module_css_default.chip} ${chip.tone}`,
														children: chip.label
													}, chip.key)),
													row.childCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: `${archive_module_css_default.chip} ${archive_module_css_default.chipNeutral}`,
														children: t("arch.row.children", { n: row.childCount })
													})
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: archive_module_css_default.rowMeta,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
														className: archive_module_css_default.rowId,
														children: row.id
													}),
													row.workspaceIds.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.workspaceIds.map(workspaceTitle).join(" · ") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: archive_module_css_default.muted,
														children: t("arch.filter.workspace.none")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.lastActivityAt === void 0 ? t("arch.row.lastActivity.unknown") : t("arch.row.lastActivity", { time: formatTime(row.lastActivityAt) }) }),
													row.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.archivedAt === void 0 ? t("arch.row.archivedAt.unknown") : t("arch.row.archivedAt", { time: formatTime(row.archivedAt) }) }),
													row.sizeBytes !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("arch.row.size", { size: formatBytes(row.sizeBytes) }) }),
													issues.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: archive_module_css_default.issueText,
														children: issues.join(" · ")
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: archive_module_css_default.rowActions,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: archive_module_css_default.linkButton,
													onClick: () => {
														controller.openPreview(row.id);
													},
													children: t("arch.op.preview")
												}),
												!row.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: archive_module_css_default.linkButton,
													disabled: busy,
													onClick: () => {
														controller.runBatch("archive", [row.id]);
													},
													children: t("arch.op.archive")
												}),
												row.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: archive_module_css_default.linkButton,
													disabled: busy,
													onClick: () => {
														controller.runBatch("unarchive", [row.id]);
													},
													children: t("arch.op.unarchive")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: `${archive_module_css_default.linkButton} ${archive_module_css_default.linkDanger}`,
													disabled: busy,
													onClick: () => {
														requestDelete([row.id]);
													},
													children: t("arch.op.delete")
												})
											]
										})
									]
								}, row.id);
							}),
							filtered.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: archive_module_css_default.moreRow,
								"data-dsh-part": "pagination",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: archive_module_css_default.button,
										disabled: page === 0,
										onClick: () => {
											controller.store.actions.setPage(page - 1);
										},
										children: t("arch.page.prev")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: archive_module_css_default.muted,
										children: t("arch.page.info", {
											page: page + 1,
											pages: totalPages,
											n: filtered.length
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: archive_module_css_default.button,
										disabled: page >= totalPages - 1,
										onClick: () => {
											controller.store.actions.setPage(page + 1);
										},
										children: t("arch.page.next")
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AutoSettingsPanel, {
						settings: props.settings,
						controller,
						auto: ui.inventory?.auto
					}),
					ui.confirmDelete !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeleteConfirmDialog, {
						state: ui.confirmDelete,
						onConfirm: () => {
							controller.runBatch("delete", ui.confirmDelete?.ids ?? []);
						},
						onCancel: () => {
							controller.store.actions.setConfirmDelete(null);
						}
					}),
					ui.batch !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BatchDialog, {
						batch: ui.batch,
						onClose: () => {
							controller.store.actions.closeBatch();
						},
						onRetryFailed: () => {
							controller.retryFailed();
						}
					}),
					ui.preview !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewDialog, {
						preview: ui.preview,
						onClose: () => {
							controller.store.actions.setPreview(null);
						},
						onRetry: () => {
							controller.openPreview(ui.preview?.id ?? "");
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings-entry-form.ts
		/** The snapshot a form reports before the Host has answered with this entry. */
		function pendingSnapshot() {
			return {
				status: "loading",
				value: void 0,
				base: void 0,
				user: void 0,
				revision: void 0,
				writable: false,
				mode: "host"
			};
		}
		/**
		* Create a settings form bound to the profile entry id this Host serves, and
		* rebound whenever the shared describe mirror names a different one of this
		* package's rows.
		* @param options - the shared forms service and this package's candidate row ids.
		* @returns a form delegating to the currently resolved entry's own form.
		*/
		function createServedEntryForm(options) {
			const { forms, entryIds } = options;
			const fallbackId = entryIds[0];
			const namespaceId = entryIds[entryIds.length - 1];
			const listeners = /* @__PURE__ */ new Set();
			let boundId;
			let bound;
			let offBound;
			let snapshot = pendingSnapshot();
			/** Republish: the delegated snapshot when one is bound, the pending one otherwise. */
			const publish = () => {
				if (bound !== void 0) snapshot = bound.getSnapshot();
				for (const listener of [...listeners]) listener();
			};
			/**
			* The entry id the mirror currently justifies. An unanswered or empty mirror
			* is not evidence of absence, so it keeps the first candidate; a mirror that
			* answers without any of this package's rows leaves the namespace itself.
			* @returns the entry id to bind.
			*/
			const resolve = () => {
				let served;
				try {
					served = forms.describe().getSnapshot().view?.namespaces.map((row) => row.ns);
				} catch {
					served = void 0;
				}
				if (served === void 0 || served.length === 0) return fallbackId;
				return entryIds.find((id) => served.includes(id)) ?? namespaceId;
			};
			/** Bind (or rebind) the resolved entry's form; a no-op while it is unchanged. */
			const bind = () => {
				const target = resolve();
				if (target === boundId) return;
				offBound?.();
				offBound = void 0;
				let form;
				try {
					form = forms.get(target);
				} catch {
					boundId = void 0;
					return;
				}
				boundId = target;
				bound = form;
				offBound = form.subscribe(() => {
					publish();
				});
				publish();
			};
			try {
				forms.describe().subscribe(() => {
					bind();
				});
			} catch {}
			bind();
			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set: (field, value) => bound?.set(field, value) ?? Promise.resolve(false),
				unset: (field) => bound?.unset(field) ?? Promise.resolve(false),
				mutate: (ops, expectedRevision) => bound?.mutate(ops, expectedRevision) ?? Promise.resolve(false)
			};
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* Settings this section edits. The family binder (`ctx.get('webUiSettings')`)
		* resolves it onto the row's profile entry id — `web-ui-session-archive` under
		* the aggregate, `session-archive` standalone — while a deployment without the
		* group plugin binds the entry id the describe mirror justifies, rebound as soon
		* as the mirror answers.
		*/
		const ARCHIVE_SETTINGS_NS = "session-archive";
		/** Profile entry ids this package's patch rows carry, most likely first. */
		const ARCHIVE_ENTRY_IDS = ["web-ui-session-archive", ARCHIVE_SETTINGS_NS];
		/**
		* Nav position (and id) of the official archived-sessions entry this plugin
		* supersedes: the native page seats `settings.section` id
		* `archived-sessions` at order 25, so taking over the id and the order keeps
		* the single entry exactly where users already look for it.
		*/
		const SECTION_ID = "archived-sessions";
		const SECTION_ORDER = 25;
		/** Required services. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"configForms",
			"remote",
			"sessions"
		];
		/**
		* Client plugin body: register dictionaries and seat the settings section.
		* The controller and store live with the apply body, so the last inventory
		* renders instantly when the section is reopened.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				try {
					return ctx.locale.register(NS, {
						zh,
						en
					});
				} catch {
					return () => {};
				}
			}, "dsh-session-archive: dictionaries");
			try {
				setRuntimeTranslate(ctx.locale.bind(NS));
			} catch {}
			const binder = ctx.get("webUiSettings");
			const settingsForm = binder !== void 0 ? binder.bind({ namespace: ARCHIVE_SETTINGS_NS }) : createServedEntryForm({
				forms: ctx.configForms,
				entryIds: ARCHIVE_ENTRY_IDS
			});
			const controller = new ArchiveController({ sessions: (() => {
				try {
					const sessions = ctx.get("sessions");
					if (sessions === void 0) return void 0;
					const refresh = typeof sessions.refresh === "function" ? sessions.refresh.bind(sessions) : void 0;
					const current = () => {
						try {
							return mainViewSessionId(sessions.list?.getSnapshot?.()?.byId);
						} catch {
							return;
						}
					};
					return {
						current,
						...refresh !== void 0 ? { refresh: () => refresh() } : {}
					};
				} catch {
					return;
				}
			})() });
			const face = () => ({
				controller,
				settings: settingsForm
			});
			ctx.slots.inject("settings.section", () => {
				try {
					const unregister = ctx.slots.register({
						name: "settings.section",
						id: SECTION_ID,
						order: SECTION_ORDER,
						label: () => ctx.locale.bind(NS)("arch.nav"),
						locale: NS,
						inject: face
					}, SessionArchiveCard);
					return () => {
						unregister();
					};
				} catch {
					return () => {};
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map