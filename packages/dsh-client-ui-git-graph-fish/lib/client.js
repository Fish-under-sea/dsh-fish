window.__ModuleLoader__.load({
	id: "@fish-under-sea/dsh-client-ui-git-graph-fish",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/sse-leader.ts
		/** Live relays keyed by event name + URL (one per tab, ref-counted by listeners). */
		const relays = /* @__PURE__ */ new Map();
		/**
		* Subscribe to an SSE endpoint shared across every tab of the browser.
		* @param url - same-origin EventSource URL (including its query string).
		* @param eventName - the SSE event field to listen for (e.g. 'change').
		* @param onEvent - fired with the raw event data string on every push.
		* @param seams - constructor overrides (tests).
		* @returns the disposer; destroying the LAST local listener tears the relay down.
		*/
		function subscribeSharedEvents(url, eventName, onEvent, seams = {}) {
			const key = eventName + " " + url;
			let relay = relays.get(key);
			if (relay === void 0) {
				relay = createRelay(key, url, eventName, seams);
				relays.set(key, relay);
			}
			relay.listeners.add(onEvent);
			return () => {
				const current = relays.get(key);
				if (current === void 0) return;
				current.listeners.delete(onEvent);
				if (current.listeners.size === 0) {
					current.destroy();
					relays.delete(key);
				}
			};
		}
		function createRelay(key, url, eventName, seams) {
			const listeners = /* @__PURE__ */ new Set();
			const dispatch = (data) => {
				for (const listener of [...listeners]) listener(data);
			};
			const EventSourceImpl = seams.eventSource ?? EventSource;
			const ChannelImpl = seams.broadcastChannel ?? (typeof BroadcastChannel === "undefined" ? void 0 : BroadcastChannel);
			const locks = seams.locks ?? (typeof navigator === "undefined" || navigator.locks === void 0 ? void 0 : navigator.locks);
			if (ChannelImpl === void 0 || locks === void 0) {
				const source = new EventSourceImpl(url);
				source.addEventListener(eventName, (raw) => {
					dispatch(raw.data);
				});
				return {
					listeners,
					destroy: () => {
						source.close();
					}
				};
			}
			const channel = new ChannelImpl("dsh-sse:" + key);
			channel.addEventListener("message", (raw) => {
				dispatch(raw.data);
			});
			const abort = new AbortController();
			let release;
			let source;
			locks.request("dsh-sse:" + key, { signal: abort.signal }, () => {
				source = new EventSourceImpl(url);
				source.addEventListener(eventName, (raw) => {
					const data = raw.data;
					channel.postMessage(data);
					dispatch(data);
				});
				return new Promise((resolve) => {
					release = resolve;
				});
			}).catch(() => {});
			return {
				listeners,
				destroy() {
					channel.close();
					abort.abort();
					release?.();
					source?.close();
				}
			};
		}
		//#endregion
		//#region src/client/api.ts
		/**
		* Browser client for the host /git/* routes: typed JSON envelope calls plus
		* the SSE change subscription. Same-origin relative fetch (the page and the
		* routes share the webserver).
		* @module dsh-git-graph/client/api
		*/
		/** Transport failure (fetch threw or the response was not JSON). */
		const TRANSPORT_ERROR = {
			code: "internal",
			message: "git route unavailable"
		};
		/**
		* POST one JSON payload and decode the envelope; never throws.
		*
		* `path` is DOCUMENT-RELATIVE (no leading slash): the harness serves the GUI
		* with `<base href="./">`, so a sub-path deployment resolves the route
		* against its entry directory. A root-absolute path escapes that prefix and
		* never reaches the host route (issue #1707); the official client posts its
		* own routes the same way.
		*/
		async function post(path, payload) {
			let response;
			try {
				response = await fetch(path, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				});
			} catch {
				return {
					ok: false,
					error: TRANSPORT_ERROR
				};
			}
			try {
				const envelope = await response.json();
				if (typeof envelope !== "object" || envelope === null) return {
					ok: false,
					error: TRANSPORT_ERROR
				};
				const record = envelope;
				if (record.ok === true) return {
					ok: true,
					value: record.value
				};
				return {
					ok: false,
					error: record.error ?? TRANSPORT_ERROR
				};
			} catch {
				return {
					ok: false,
					error: TRANSPORT_ERROR
				};
			}
		}
		/** Typed git operations over the wire. */
		var GitApi = class {
			/** The repository snapshot (null: not a git repository / not a workspace). */
			status(path) {
				return post("git/status", { path });
			}
			/** Local branch list with the current branch marked. */
			branches(path) {
				return post("git/branches", { path });
			}
			/** Workspace-level `git switch --no-guess <branch>` (host guards first). */
			switchBranch(path, branch) {
				return post("git/switch", {
					path,
					branch
				});
			}
			/** `git switch --no-guess -c <name>` from the current HEAD. */
			createBranch(path, name) {
				return post("git/create-branch", {
					path,
					name
				});
			}
			/** Topo-ordered commit graph across branches/tags/remotes. */
			graph(path, limit) {
				return post("git/graph", limit === void 0 ? { path } : {
					path,
					limit
				});
			}
			/** All linked worktrees of the workspace's repository. */
			worktrees(path) {
				return post("git/worktrees", { path });
			}
			/** Create a managed worktree on a new wt/<name> branch (host picks the path). */
			addWorktree(path, name, baseRef) {
				return post("git/worktree-add", baseRef === void 0 ? {
					path,
					name
				} : {
					path,
					name,
					baseRef
				});
			}
			/** Remove a managed worktree (dirty rejects unless force; deleteBranch drops the wt/ branch). */
			removeWorktree(path, worktreePath, opts) {
				return post("git/worktree-remove", {
					path,
					worktreePath,
					force: opts?.force === true,
					deleteBranch: opts?.deleteBranch === true
				});
			}
			/** The live feature config (auto-isolation flags + managed worktree home). */
			config() {
				return post("git/config", {});
			}
		};
		/**
		* Subscribe to host-pushed branch-state changes for one workspace path (the
		* host polls the workspace while a subscriber is connected). Reconnects are
		* handled by the EventSource; the caller re-subscribes when the path changes.
		* @param path - workspace root to watch.
		* @param onChange - fired on every pushed change.
		* @returns the disposer closing the stream.
		*/
		function subscribeChanges(path, onChange) {
			return subscribeSharedEvents(`git/events?path=${encodeURIComponent(path)}`, "change", () => {
				onChange();
			});
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-git-graph-fish/src/client/chips/context.module.css.mjs
		const css = ".k5_lVq_anchor{position:relative}.k5_lVq_chipWrap{display:inline-flex;position:relative}.k5_lVq_anchorHero{align-items:center;padding-left:0;display:inline-flex}.k5_lVq_chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-tool-bar-fill);height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;border-radius:999px;align-items:center;gap:6px;padding:0 10px;font-size:12px;line-height:1;transition:background-color .12s,border-color .12s,color .12s,gap .12s,padding .12s;display:inline-flex}.k5_lVq_chip:hover{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_chip:active{background:var(--dsw-alias-interactive-bg-active)}.k5_lVq_chip:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary);outline:none}.k5_lVq_chip:disabled{opacity:.55;cursor:not-allowed}.k5_lVq_chip:disabled:hover{background:var(--dsw-alias-button-tool-bar-fill)}.k5_lVq_chipOpen{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}.k5_lVq_chipLabel{text-overflow:ellipsis;max-width:220px;overflow:hidden}.k5_lVq_chipChevron{color:var(--dsw-alias-label-tertiary)}.k5_lVq_chipHero{max-width:min(100%,240px);height:auto;min-height:28px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:16px;gap:4px;padding:0 8px;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.k5_lVq_chipHero:hover,.k5_lVq_chipHero:active,.k5_lVq_chipHero.k5_lVq_chipOpen{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_chipHero .k5_lVq_chipLabel{max-width:180px}.k5_lVq_chipHero .k5_lVq_chipChevron{color:var(--dsw-alias-label-caption)}.k5_lVq_backdrop{z-index:30;position:fixed;inset:0}.k5_lVq_popover{z-index:100;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:280px;max-height:360px;box-shadow:var(--dsw-shadow-lv3);border-radius:12px;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 8px);left:0;overflow:hidden}.k5_lVq_popoverHero{top:calc(100% + 4px);bottom:auto}.k5_lVq_searchBox{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary);border:2px solid #0000;border-radius:8px;align-items:center;gap:6px;margin:8px;padding:6px 10px;transition:border-color .12s,box-shadow .12s;display:flex}.k5_lVq_searchBox:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:none}body[data-ds-dark-theme] .k5_lVq_searchBox{background:var(--dsw-alias-bg-base)}.k5_lVq_searchInput{min-width:0;color:var(--dsw-alias-label-primary);background:0 0;border:none;outline:none;flex:1;font-size:13px;transition:box-shadow .12s}.k5_lVq_searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}.k5_lVq_list{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent;flex:1;min-height:64px;padding:2px 6px 6px;overflow:hidden auto}.k5_lVq_list::-webkit-scrollbar{width:6px}.k5_lVq_list::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2);border-radius:3px}.k5_lVq_list::-webkit-scrollbar-track{background:0 0}.k5_lVq_item{box-sizing:border-box;cursor:pointer;text-align:left;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;width:100%;min-width:0;max-width:100%;padding:7px 8px;transition:background-color .12s;display:flex;position:relative}.k5_lVq_item:hover{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_item:active{background:var(--dsw-alias-interactive-bg-active)}.k5_lVq_item:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary);outline:none}.k5_lVq_item:disabled{opacity:.55;cursor:not-allowed}.k5_lVq_item:disabled:hover{background:0 0}.k5_lVq_itemText{flex:1;min-width:0}.k5_lVq_itemName{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:13px;display:block;overflow:hidden}.k5_lVq_itemPath{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);margin-top:1px;font-size:11px;overflow:hidden}.k5_lVq_check{color:var(--dsw-alias-brand-primary);flex:none}.k5_lVq_empty{text-align:center;color:var(--dsw-alias-label-tertiary);padding:14px 10px;font-size:12px}.k5_lVq_dirty{color:var(--dsw-alias-state-warn-primary);margin:0 10px 4px;font-size:11px}.k5_lVq_notice{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);color:var(--dsw-alias-state-error-primary);border-radius:8px;margin:0 8px 8px;padding:6px 10px;font-size:12px}.k5_lVq_noticeOk{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent);color:var(--dsw-alias-state-success-primary)}.k5_lVq_footer{border-top:1px solid var(--dsw-alias-border-l1);flex-direction:column;gap:2px;padding:6px;display:flex}.k5_lVq_footerItem{cursor:pointer;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:7px 10px;font-size:13px;transition:background-color .12s;display:flex}.k5_lVq_footerItem:hover{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_footerItem:active{background:var(--dsw-alias-interactive-bg-active)}.k5_lVq_footerItem:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary);outline:none}.k5_lVq_footerItem:disabled{opacity:.55;cursor:not-allowed}.k5_lVq_footerItem:disabled:hover{background:0 0}.k5_lVq_footerItemDisabled{opacity:.55;cursor:not-allowed}.k5_lVq_footerItemDisabled:hover{background:0 0}.k5_lVq_footerHint{color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:11px}.k5_lVq_dialog{z-index:50;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);width:min(760px,100vw - 48px);max-height:min(76vh,720px);box-shadow:0 12px 32px var(--dsw-alias-bg-mask-2);border-radius:12px;flex-direction:column;padding:16px 16px 12px;display:flex;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)}.k5_lVq_dialogHeader{justify-content:space-between;align-items:flex-start;gap:12px;padding:0 4px;display:flex}.k5_lVq_dialogHeading{min-width:0}.k5_lVq_dialogClose{width:26px;height:26px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:8px;flex:none;justify-content:center;align-items:center;margin:-2px;transition:background-color .12s,color .12s;display:inline-flex}.k5_lVq_dialogClose:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.k5_lVq_dialogClose:active{background:var(--dsw-alias-interactive-bg-active)}.k5_lVq_dialogClose:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary);outline:none}.k5_lVq_dialogTitle{color:var(--dsw-alias-label-primary);margin:0 0 2px;font-size:15px;font-weight:600}.k5_lVq_dialogDescription{color:var(--dsw-alias-label-secondary);margin:0 0 12px;font-size:12px;line-height:1.5}.k5_lVq_dialogField{flex-direction:column;gap:6px;display:flex}.k5_lVq_dialogLabel{color:var(--dsw-alias-label-secondary);font-size:12px}.k5_lVq_dialogInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;outline:none;padding:8px 10px;font-size:13px;transition:border-color .12s,box-shadow .12s}.k5_lVq_dialogInput:focus{border-color:var(--dsw-alias-brand-primary)}.k5_lVq_dialogInput:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}.k5_lVq_dialogError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px}.k5_lVq_dialogActions{justify-content:flex-end;gap:8px;margin-top:14px;display:flex}.k5_lVq_dialogButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:6px 14px;font-size:13px;transition:background-color .12s,border-color .12s,color .12s}.k5_lVq_dialogButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_dialogButton:active{background:var(--dsw-alias-interactive-bg-active)}.k5_lVq_dialogButton:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary);outline:none}.k5_lVq_dialogButton:disabled{opacity:.55;cursor:not-allowed}.k5_lVq_dialogButton:disabled:hover{background:var(--dsw-alias-button-tool-bar-fill)}.k5_lVq_dialogButtonPrimary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-button-contrast-fill);transition:background-color .12s,border-color .12s,filter .12s}.k5_lVq_dialogButtonPrimary:hover{background:var(--dsw-alias-button-primary-hover)}.k5_lVq_dialogButtonPrimary:active{filter:brightness(.92)}.k5_lVq_dialogButtonPrimary:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-button-contrast-fill), 0 0 0 4px var(--dsw-alias-brand-primary);outline:none}.k5_lVq_dialogButtonPrimary:disabled{opacity:.6;cursor:not-allowed}.k5_lVq_dialogButtonPrimary:disabled:hover{background:var(--dsw-alias-brand-primary)}.k5_lVq_graphBody{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;flex:1;min-height:240px;margin-top:10px;padding:4px;overflow-y:auto}.k5_lVq_graphSubtitle{color:var(--dsw-alias-label-tertiary);margin-top:2px;font-size:11px}.k5_lVq_graphRow{border-radius:8px;align-items:center;gap:10px;padding:7px 8px;font-size:12px;display:flex}.k5_lVq_graphRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_graphLanes{color:var(--dsw-alias-label-tertiary);flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.4;display:flex}.k5_lVq_graphLaneCell{text-align:center;flex:none;width:15px;display:inline-block}.k5_lVq_graphLaneNode,.k5_lVq_graphLaneMerge{color:var(--dsw-alias-brand-primary);font-weight:700}.k5_lVq_graphLanePass{color:var(--dsw-alias-label-tertiary)}.k5_lVq_graphOid{min-width:58px;color:var(--dsw-alias-label-tertiary);flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}.k5_lVq_graphMain{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}.k5_lVq_graphSubject{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;overflow:hidden}.k5_lVq_graphMeta{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;align-items:center;gap:4px 6px;font-size:11px;display:flex}.k5_lVq_graphMetaSep{color:var(--dsw-alias-label-tertiary);flex:none}.k5_lVq_graphRef{text-overflow:ellipsis;background:var(--dsw-alias-bg-layer-2);max-width:120px;color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 6px;font-size:10px;overflow:hidden}.k5_lVq_graphRefCurrent{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-button-contrast-fill)}[data-gitgraph-chip-anchor][data-gitgraph-stock-light]{--gitgraph-stock-ink-rgb:15, 17, 21;--gitgraph-stock-ink:#0f1115;--gitgraph-stock-on-success:#fff;--gitgraph-stock-success-fill:#137333;--gitgraph-stock-success-border:#0f5f2b;--dsw-alias-button-tool-bar-fill:rgba(var(--gitgraph-stock-ink-rgb), .04);--dsw-alias-button-tool-bar-hover:rgba(var(--gitgraph-stock-ink-rgb), .08);--dsw-alias-border-l2:rgba(var(--gitgraph-stock-ink-rgb), .16);--dsw-alias-interactive-bg-hover:rgba(var(--gitgraph-stock-ink-rgb), .06);--dsw-alias-interactive-bg-active:rgba(var(--gitgraph-stock-ink-rgb), .1);--dsw-alias-label-primary:var(--gitgraph-stock-ink);--dsw-alias-label-secondary:var(--gitgraph-stock-ink);--dsw-alias-label-tertiary:rgba(var(--gitgraph-stock-ink-rgb), .56);--dsw-alias-button-contrast-fill:var(--gitgraph-stock-on-success)}[data-gitgraph-chip-anchor][data-gitgraph-stock-light] .k5_lVq_noticeOk{background:var(--gitgraph-stock-success-fill);color:var(--gitgraph-stock-on-success);box-shadow:inset 0 0 0 1px var(--gitgraph-stock-success-border)}.k5_lVq_graphEmpty{text-align:center;color:var(--dsw-alias-label-tertiary);padding:24px 10px;font-size:12px}.k5_lVq_graphMore{border:1px solid var(--dsw-alias-border-l1);width:100%;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:8px;margin-top:8px;padding:6px;font-size:12px;transition:background-color .12s;display:block}.k5_lVq_graphMore:hover{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_graphMore:active{background:var(--dsw-alias-interactive-bg-active)}.k5_lVq_graphMore:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary);outline:none}@media (prefers-reduced-motion:reduce){.k5_lVq_chip,.k5_lVq_searchBox,.k5_lVq_searchInput,.k5_lVq_item,.k5_lVq_footerItem,.k5_lVq_dialogClose,.k5_lVq_dialogInput,.k5_lVq_dialogButton,.k5_lVq_dialogButtonPrimary,.k5_lVq_graphMore{transition:none}}.k5_lVq_item:after{content:attr(data-tip);z-index:80;background:var(--dsw-alias-label-primary,#111);color:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l1,#ffffff40);white-space:normal;word-break:break-all;box-shadow:var(--dsw-shadow-lv3);pointer-events:none;border-radius:8px;padding:6px 8px;font-size:12px;line-height:1.5;display:none;position:absolute;bottom:calc(100% + 4px);left:0;right:0}.k5_lVq_item[data-tip=\"\"]:after{display:none!important}.k5_lVq_item[data-tip-dir=down]:after{top:calc(100% + 4px);bottom:auto}.k5_lVq_item[data-tip-ready=true]:hover:after{display:block}.k5_lVq_managerList{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;flex:1;min-height:120px;margin-top:10px;padding:4px;overflow-y:auto}.k5_lVq_managerRow{border-radius:8px;justify-content:space-between;align-items:flex-start;gap:10px;padding:8px;font-size:12px;display:flex}.k5_lVq_managerRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.k5_lVq_managerInfo{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}.k5_lVq_managerHeadline{color:var(--dsw-alias-label-primary);align-items:center;gap:6px;display:flex}.k5_lVq_managerBranch{text-overflow:ellipsis;white-space:nowrap;font-weight:500;overflow:hidden}.k5_lVq_managerBadge{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 6px;font-size:10px}.k5_lVq_managerOid{color:var(--dsw-alias-label-tertiary);flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}.k5_lVq_managerPath{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;overflow:hidden}.k5_lVq_managerConfirm{color:var(--dsw-alias-state-error-primary);align-items:center;gap:8px;margin-top:2px;font-size:12px;display:flex}.k5_lVq_managerActions{flex-direction:column;flex:none;align-items:flex-end;gap:6px;display:flex}.k5_lVq_managerCheck{color:var(--dsw-alias-label-secondary);cursor:pointer;align-items:center;gap:4px;font-size:11px;display:flex}";
		const tagId = "@fish-under-sea/dsh-client-ui-git-graph-fish/packages/dsh-client-ui-git-graph-fish/src/client/chips/context.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@fish-under-sea/dsh-client-ui-git-graph-fish";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var context_module_css_default = {
			"anchor": "k5_lVq_anchor",
			"anchorHero": "k5_lVq_anchorHero",
			"backdrop": "k5_lVq_backdrop",
			"check": "k5_lVq_check",
			"chip": "k5_lVq_chip",
			"chipChevron": "k5_lVq_chipChevron",
			"chipHero": "k5_lVq_chipHero",
			"chipLabel": "k5_lVq_chipLabel",
			"chipOpen": "k5_lVq_chipOpen",
			"chipWrap": "k5_lVq_chipWrap",
			"dialog": "k5_lVq_dialog",
			"dialogActions": "k5_lVq_dialogActions",
			"dialogButton": "k5_lVq_dialogButton",
			"dialogButtonPrimary": "k5_lVq_dialogButtonPrimary",
			"dialogClose": "k5_lVq_dialogClose",
			"dialogDescription": "k5_lVq_dialogDescription",
			"dialogError": "k5_lVq_dialogError",
			"dialogField": "k5_lVq_dialogField",
			"dialogHeader": "k5_lVq_dialogHeader",
			"dialogHeading": "k5_lVq_dialogHeading",
			"dialogInput": "k5_lVq_dialogInput",
			"dialogLabel": "k5_lVq_dialogLabel",
			"dialogTitle": "k5_lVq_dialogTitle",
			"dirty": "k5_lVq_dirty",
			"empty": "k5_lVq_empty",
			"footer": "k5_lVq_footer",
			"footerHint": "k5_lVq_footerHint",
			"footerItem": "k5_lVq_footerItem",
			"footerItemDisabled": "k5_lVq_footerItemDisabled",
			"graphBody": "k5_lVq_graphBody",
			"graphEmpty": "k5_lVq_graphEmpty",
			"graphLaneCell": "k5_lVq_graphLaneCell",
			"graphLaneMerge": "k5_lVq_graphLaneMerge",
			"graphLaneNode": "k5_lVq_graphLaneNode",
			"graphLanePass": "k5_lVq_graphLanePass",
			"graphLanes": "k5_lVq_graphLanes",
			"graphMain": "k5_lVq_graphMain",
			"graphMeta": "k5_lVq_graphMeta",
			"graphMetaSep": "k5_lVq_graphMetaSep",
			"graphMore": "k5_lVq_graphMore",
			"graphOid": "k5_lVq_graphOid",
			"graphRef": "k5_lVq_graphRef",
			"graphRefCurrent": "k5_lVq_graphRefCurrent",
			"graphRow": "k5_lVq_graphRow",
			"graphSubject": "k5_lVq_graphSubject",
			"graphSubtitle": "k5_lVq_graphSubtitle",
			"item": "k5_lVq_item",
			"itemName": "k5_lVq_itemName",
			"itemPath": "k5_lVq_itemPath",
			"itemText": "k5_lVq_itemText",
			"list": "k5_lVq_list",
			"managerActions": "k5_lVq_managerActions",
			"managerBadge": "k5_lVq_managerBadge",
			"managerBranch": "k5_lVq_managerBranch",
			"managerCheck": "k5_lVq_managerCheck",
			"managerConfirm": "k5_lVq_managerConfirm",
			"managerHeadline": "k5_lVq_managerHeadline",
			"managerInfo": "k5_lVq_managerInfo",
			"managerList": "k5_lVq_managerList",
			"managerOid": "k5_lVq_managerOid",
			"managerPath": "k5_lVq_managerPath",
			"managerRow": "k5_lVq_managerRow",
			"notice": "k5_lVq_notice",
			"noticeOk": "k5_lVq_noticeOk",
			"popover": "k5_lVq_popover",
			"popoverHero": "k5_lVq_popoverHero",
			"searchBox": "k5_lVq_searchBox",
			"searchInput": "k5_lVq_searchInput"
		};
		//#endregion
		//#region src/client/chips/Chip.tsx
		/** Join conditional class names (the dependency-free clsx stand-in). */
		function cx(...parts) {
			return parts.filter((part) => typeof part === "string" && part !== "").join(" ");
		}
		/** The pill button shared by the project and branch chips. */
		function Chip({ icon, label, ariaLabel, open, onClick, hero = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				"data-gitgraph-chip": true,
				className: cx(context_module_css_default.chip, open && context_module_css_default.chipOpen, hero && context_module_css_default.chipHero),
				onClick,
				"aria-label": ariaLabel,
				"aria-expanded": open,
				children: [
					icon,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: context_module_css_default.chipLabel,
						title: label,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineMedium, {
						className: context_module_css_default.chipChevron,
						size: 12
					})
				]
			});
		}
		/** Full-screen transparent backdrop closing the open popover/dialog on click. */
		function Backdrop({ onClose }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: context_module_css_default.backdrop,
				onClick: onClose
			});
		}
		//#endregion
		//#region src/client/chips/error-copy.ts
		/** The blocked-file sentence tail: quoted paths plus the overflow count. */
		function pathsText(error, t) {
			return `${(error.paths ?? []).map((path) => `"${path}"`).join(t("error.pathsSeparator"))}${error.moreFiles !== void 0 && error.moreFiles > 0 ? ` ${t("error.moreFiles", { count: error.moreFiles })}` : ""}`;
		}
		/**
		* One readable message for a git operation rejection.
		* @param error - the classified git error.
		* @param t - the git-graph namespace translate seat.
		* @returns the sentence for the error's code.
		*/
		function errorMessage(error, t) {
			switch (error.code) {
				case "conflicts-present": return t("error.conflictsPresent");
				case "operation-in-progress": return t("error.operationInProgress");
				case "branch-in-other-worktree": return t("error.branchInOtherWorktree");
				case "tracked-changes-would-be-overwritten": return t("error.trackedOverwrite", { paths: pathsText(error, t) });
				case "untracked-changes-would-be-overwritten": return t("error.untrackedOverwrite", { paths: pathsText(error, t) });
				case "target-branch-not-found": return t("error.targetBranchNotFound");
				case "invalid-branch-name": return t("error.invalidBranchName");
				case "branch-already-exists": return t("error.branchAlreadyExists");
				case "workspace-unknown": return t("error.workspaceUnknown");
				case "invalid-worktree-name": return t("error.invalidWorktreeName");
				case "worktree-already-exists": return t("error.worktreeAlreadyExists");
				case "worktree-dirty": return t("error.worktreeDirty");
				case "worktree-not-found": return t("error.worktreeNotFound");
				case "worktree-is-main": return t("error.worktreeIsMain");
				case "base-ref-not-found": return t("error.baseRefNotFound");
				case "internal": return t("error.requestFailed", { error: error.message });
			}
		}
		//#endregion
		//#region src/client/chips/BranchPopover.tsx
		/**
		* The branch picker popover: searchable local branch list with the current
		* branch checked, the dirtiness line, switch feedback (success/error), and
		* the footer flows (create branch / Git graph).
		* @module dsh-git-graph/client/chips/BranchPopover
		*/
		/** How long the success notice stays before the popover closes itself. */
		const SUCCESS_DISMISS_MS = 900;
		/**
		* The branch picker popover.
		* @param props - see {@link BranchPopoverProps}.
		*/
		function BranchPopover({ view, onSwitch, onSwitched, onCreate, onGraph, onCreateWorktree, onManageWorktrees, onClose, t, hero = false }) {
			const [query, setQuery] = (0, react.useState)("");
			const [pending, setPending] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [success, setSuccess] = (0, react.useState)(null);
			const dismissTimer = (0, react.useRef)(void 0);
			const [tipReadyName, setTipReadyName] = (0, react.useState)(null);
			const [tipActive, setTipActive] = (0, react.useState)(false);
			const [tipDir, setTipDir] = (0, react.useState)("up");
			const tipTimer = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => () => {
				if (dismissTimer.current !== void 0) clearTimeout(dismissTimer.current);
				if (tipTimer.current !== void 0) clearTimeout(tipTimer.current);
			}, []);
			const filtered = (0, react.useMemo)(() => {
				const needle = query.trim().toLowerCase();
				if (needle === "") return view.branches;
				return view.branches.filter((branch) => branch.name.toLowerCase().includes(needle));
			}, [view.branches, query]);
			const switchTo = (branch) => {
				if (pending !== null) return;
				setPending(branch);
				setError(null);
				setSuccess(null);
				onSwitch(branch).then((result) => {
					if (result.ok) {
						onSwitched();
						setSuccess(t("toast.switchSuccess", { branchName: result.branch }));
						dismissTimer.current = setTimeout(onClose, SUCCESS_DISMISS_MS);
						return;
					}
					setError(errorMessage(result.error, t));
				}).finally(() => {
					setPending(null);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Backdrop, { onClose }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: cx(context_module_css_default.popover, hero && context_module_css_default.popoverHero),
				role: "listbox",
				"aria-label": t("branch.search"),
				"data-gitgraph-popover": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.searchBox,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: context_module_css_default.searchInput,
							value: query,
							onChange: (event) => {
								setQuery(event.target.value);
							},
							placeholder: t("branch.search"),
							autoFocus: true
						})]
					}),
					view.dirtyFiles > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.dirty,
						children: t("branch.dirty", { count: view.dirtyFiles })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.list,
						onMouseLeave: () => {
							if (tipTimer.current !== void 0) {
								clearTimeout(tipTimer.current);
								tipTimer.current = void 0;
							}
							setTipActive(false);
							setTipReadyName(null);
						},
						children: filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: context_module_css_default.empty,
							children: t("branch.empty")
						}) : filtered.map((branch) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: cx(context_module_css_default.item, branch.current && context_module_css_default.itemActive),
							onClick: () => {
								switchTo(branch.name);
							},
							role: "option",
							"aria-selected": branch.current,
							"data-tip": branch.name.length > 18 ? branch.name : "",
							"data-tip-ready": branch.name === tipReadyName ? "true" : "",
							"aria-label": branch.name,
							"data-tip-dir": tipDir,
							onMouseEnter: (event) => {
								if (tipTimer.current !== void 0) clearTimeout(tipTimer.current);
								const list = event.currentTarget.parentElement;
								if (list !== null) {
									const itemTop = event.currentTarget.getBoundingClientRect().top;
									const listTop = list.getBoundingClientRect().top;
									setTipDir(itemTop - listTop < 56 ? "down" : "up");
								}
								if (tipActive) setTipReadyName(branch.name);
								else tipTimer.current = setTimeout(() => {
									setTipActive(true);
									setTipReadyName(branch.name);
								}, 500);
							},
							disabled: pending !== null,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: context_module_css_default.itemText,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: context_module_css_default.itemName,
										title: branch.name,
										children: branch.name
									})
								}),
								branch.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineMedium, {
									className: context_module_css_default.check,
									size: 14
								})
							]
						}, branch.name))
					}),
					success !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: cx(context_module_css_default.notice, context_module_css_default.noticeOk),
						children: success
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.notice,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.footer,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: context_module_css_default.footerItem,
								onClick: onCreate,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }), t("branch.create")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: context_module_css_default.footerItem,
								onClick: onGraph,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }), t("branch.graph")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: context_module_css_default.footerItem,
								onClick: onCreateWorktree,
								"data-dsh-part": "worktree-create",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }), t("worktree.create")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: context_module_css_default.footerItem,
								onClick: onManageWorktrees,
								"data-dsh-part": "worktree-manage",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }), t("worktree.manage")]
							})
						]
					})
				]
			})] });
		}
		//#endregion
		//#region src/core/git-command.ts
		/**
		* Sanitize a user/agent-supplied worktree name into a safe directory and
		* branch component: lowercase, alnum plus ._-, no leading/trailing dash/dot,
		* capped at 64 chars. Returns null when nothing usable remains.
		* @param raw - the proposed worktree name.
		*/
		function sanitizeWorktreeName(raw) {
			const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.]+/, "").replace(/[-.]+$/, "").slice(0, 64);
			if (cleaned === "" || cleaned === "." || cleaned === "..") return null;
			return cleaned;
		}
		new TextEncoder();
		new TextDecoder();
		/**
		* Pure mirror of `git check-ref-format --branch` short-name rules, for
		* instant client-side feedback; the host's check-ref-format call stays the
		* authoritative gate. Returns the reason when the name is invalid.
		* @param name - proposed branch name (short form, no refs/ prefix).
		* @returns null when valid, else a short reason.
		*/
		function validateBranchName(name) {
			if (name === "") return "empty";
			if (name === "@") return "at-sign";
			if (name.startsWith("-")) return "leading-dash";
			if (name.endsWith(".")) return "trailing-dot";
			if (name.endsWith(".lock")) return "lock-suffix";
			if (name.includes("..")) return "double-dot";
			if (name.includes("@{")) return "at-brace";
			if (name.includes("//")) return "double-slash";
			if (name.includes(" ")) return "space";
			if (name.includes("~") || name.includes("^") || name.includes(":")) return "forbidden-char";
			if (name.includes("?") || name.includes("*") || name.includes("[") || name.includes("\\")) return "forbidden-char";
			for (const ch of name) {
				const code = ch.codePointAt(0);
				if (code !== void 0 && (code < 32 || code === 127)) return "control-char";
			}
			for (const component of name.split("/")) {
				if (component === "") return "empty-component";
				if (component.startsWith(".")) return "dot-component";
				if (component.endsWith(".lock")) return "lock-suffix";
			}
			if (name.length > 1e3) return "too-long";
			return null;
		}
		//#endregion
		//#region src/client/chips/CreateBranchDialog.tsx
		/**
		* The create-branch dialog: name input with the pure validation mirror for
		* instant feedback, the host `check-ref-format` gate as the authority, and
		* readable rejection copy.
		* @module dsh-git-graph/client/chips/CreateBranchDialog
		*/
		/**
		* The create-and-switch dialog.
		* @param props - see {@link CreateBranchDialogProps}.
		*/
		function CreateBranchDialog({ onCreate, onClose, t }) {
			const [name, setName] = (0, react.useState)("");
			const [pending, setPending] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const submit = () => {
				if (pending) return;
				const trimmed = name.trim();
				if (validateBranchName(trimmed) !== null) {
					setError(t("error.invalidBranchName"));
					return;
				}
				setPending(true);
				setError(null);
				onCreate(trimmed).then((result) => {
					if (result.ok) {
						onClose();
						return;
					}
					setError(errorMessage(result.error, t));
				}).finally(() => {
					setPending(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Backdrop, { onClose }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: context_module_css_default.dialog,
				role: "dialog",
				"aria-label": t("branch.createDialog.title"),
				"data-gitgraph-dialog": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: context_module_css_default.dialogTitle,
						children: t("branch.createDialog.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: context_module_css_default.dialogDescription,
						children: t("branch.createDialog.description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.dialogField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: context_module_css_default.dialogLabel,
							htmlFor: "git-graph-branch-name",
							children: t("branch.createDialog.nameLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id: "git-graph-branch-name",
							className: context_module_css_default.dialogInput,
							value: name,
							onChange: (event) => {
								setName(event.target.value);
							},
							placeholder: t("branch.createDialog.placeholder"),
							onKeyDown: (event) => {
								if (event.key === "Enter") submit();
							},
							autoFocus: true
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.dialogError,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.dialogActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: context_module_css_default.dialogButton,
							onClick: onClose,
							children: t("branch.createDialog.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: context_module_css_default.dialogButtonPrimary,
							onClick: submit,
							disabled: pending || name.trim() === "",
							children: t("branch.createDialog.confirm")
						})]
					})
				]
			})] });
		}
		//#endregion
		//#region src/client/chips/CreateWorktreeDialog.tsx
		/**
		* The create-worktree dialog: name input with the sanitizer mirror for
		* instant feedback, a base-branch picker (default: the checkout's current
		* branch), and readable rejection copy. Success registers the worktree as a
		* workspace and starts a new session in it (the owner owns that flow).
		* @module dsh-git-graph/client/chips/CreateWorktreeDialog
		*/
		/**
		* The create-worktree-and-start-session dialog.
		* @param props - see {@link CreateWorktreeDialogProps}.
		*/
		function CreateWorktreeDialog({ branches, currentBranch, onCreate, onClose, t }) {
			const [name, setName] = (0, react.useState)("");
			const [baseRef, setBaseRef] = (0, react.useState)(currentBranch);
			const [pending, setPending] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const sanitized = sanitizeWorktreeName(name);
			const submit = () => {
				if (pending) return;
				if (sanitized === null) {
					setError(t("error.invalidWorktreeName"));
					return;
				}
				setPending(true);
				setError(null);
				onCreate(sanitized, baseRef === "" ? void 0 : baseRef).then((result) => {
					if (result.ok) {
						onClose();
						return;
					}
					setError(errorMessage(result.error, t));
				}).finally(() => {
					setPending(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Backdrop, { onClose }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: context_module_css_default.dialog,
				role: "dialog",
				"aria-label": t("worktree.dialog.title"),
				"data-gitgraph-worktree-dialog": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: context_module_css_default.dialogTitle,
						children: t("worktree.dialog.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: context_module_css_default.dialogDescription,
						children: t("worktree.dialog.description")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.dialogField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: context_module_css_default.dialogLabel,
							htmlFor: "git-graph-worktree-name",
							children: t("worktree.dialog.nameLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id: "git-graph-worktree-name",
							className: context_module_css_default.dialogInput,
							value: name,
							onChange: (event) => {
								setName(event.target.value);
							},
							placeholder: t("worktree.dialog.namePlaceholder"),
							onKeyDown: (event) => {
								if (event.key === "Enter") submit();
							},
							autoFocus: true
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.dialogField,
						style: { marginTop: 10 },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: context_module_css_default.dialogLabel,
							htmlFor: "git-graph-worktree-base",
							children: t("worktree.dialog.baseLabel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							id: "git-graph-worktree-base",
							className: context_module_css_default.dialogInput,
							value: baseRef,
							onChange: (event) => {
								setBaseRef(event.target.value);
							},
							children: branches.map((branch) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: branch.name,
								children: branch.name
							}, branch.name))
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.dialogError,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.dialogActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: context_module_css_default.dialogButton,
							onClick: onClose,
							children: t("worktree.dialog.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: context_module_css_default.dialogButtonPrimary,
							onClick: submit,
							disabled: pending || name.trim() === "",
							children: t("worktree.dialog.confirm")
						})]
					})
				]
			})] });
		}
		//#endregion
		//#region src/client/worktrees/WorktreeManager.tsx
		/**
		* The worktree manager dialog: every linked worktree of the repository with
		* its branch/head, plus removal of managed worktrees. Dirty worktrees reject
		* once and surface an inline force-confirm; the wt/ branch survives removal
		* unless the row's delete-branch checkbox is on. The primary checkout row is
		* display-only.
		* @module dsh-git-graph/client/worktrees/WorktreeManager
		*/
		/**
		* The worktree manager dialog.
		* @param props - see {@link WorktreeManagerProps}.
		*/
		function WorktreeManager({ fetchWorktrees, onRemove, onClose, t }) {
			const [view, setView] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			/** Row awaiting an inline force-confirm after a worktree-dirty rejection. */
			const [forcePath, setForcePath] = (0, react.useState)(null);
			/** Rows whose wt/ branch should be deleted together with the worktree. */
			const [branchDelete, setBranchDelete] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [pending, setPending] = (0, react.useState)(null);
			const reload = (0, react.useCallback)(() => {
				let live = true;
				setLoading(true);
				fetchWorktrees().then((fresh) => {
					if (!live) return;
					setView(fresh);
					setLoading(false);
				});
				return () => {
					live = false;
				};
			}, [fetchWorktrees]);
			(0, react.useEffect)(() => reload(), [reload]);
			const remove = (item, force) => {
				if (pending !== null) return;
				setPending(item.path);
				setError(null);
				onRemove(item.path, {
					force,
					deleteBranch: branchDelete.has(item.path)
				}).then((result) => {
					if (result.ok) {
						setForcePath(null);
						reload();
						return;
					}
					if (result.error.code === "worktree-dirty" && !force) {
						setForcePath(item.path);
						return;
					}
					setError(errorMessage(result.error, t));
				}).finally(() => {
					setPending(null);
				});
			};
			const toggleBranchDelete = (path) => {
				setBranchDelete((previous) => {
					const next = new Set(previous);
					if (next.has(path)) next.delete(path);
					else next.add(path);
					return next;
				});
			};
			const rows = view?.worktrees ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Backdrop, { onClose }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: context_module_css_default.dialog,
				role: "dialog",
				"aria-label": t("worktree.manager.title"),
				"data-gitgraph-worktree-manager": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: context_module_css_default.dialogTitle,
						children: t("worktree.manager.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.managerList,
						children: [
							loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: context_module_css_default.graphEmpty,
								children: t("worktree.manager.loading")
							}),
							!loading && rows.length <= 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: context_module_css_default.graphEmpty,
								children: t("worktree.manager.empty")
							}),
							!loading && rows.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: context_module_css_default.managerRow,
								"data-main": item.main || void 0,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: context_module_css_default.managerInfo,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: context_module_css_default.managerHeadline,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 13 }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: context_module_css_default.managerBranch,
													children: item.branch === "" ? t("worktree.manager.detached") : item.branch
												}),
												item.main && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: context_module_css_default.managerBadge,
													children: t("worktree.manager.main")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: context_module_css_default.managerOid,
													children: item.head.slice(0, 7)
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: context_module_css_default.managerPath,
											title: item.path,
											children: item.path
										}),
										forcePath === item.path && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: context_module_css_default.managerConfirm,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("worktree.manager.forceConfirm") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: context_module_css_default.dialogButton,
												disabled: pending !== null,
												onClick: () => {
													remove(item, true);
												},
												children: t("worktree.manager.forceYes")
											})]
										})
									]
								}), !item.main && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: context_module_css_default.managerActions,
									children: [item.branch.startsWith("wt/") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: context_module_css_default.managerCheck,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: branchDelete.has(item.path),
											onChange: () => {
												toggleBranchDelete(item.path);
											}
										}), t("worktree.manager.deleteBranch")]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: context_module_css_default.dialogButton,
										disabled: pending !== null,
										onClick: () => {
											remove(item, false);
										},
										children: t("worktree.manager.remove")
									})]
								})]
							}, item.path))
						]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.dialogError,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.dialogActions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: cx(context_module_css_default.dialogButton),
							onClick: onClose,
							children: t("worktree.manager.close")
						})
					})
				]
			})] });
		}
		//#endregion
		//#region src/core/types.ts
		/**
		* Minimal lane assignment over topo-ordered rows: each lane waits for one
		* commit; the first parent continues the node's lane, further parents start
		* (or join) lanes to the right. Correct for linear, branched, and merged
		* histories; the columns alone carry the topology (the renderer draws them
		* as monospace lane text).
		* @param rows - topo-ordered rows with parents (later rows = ancestors).
		* @returns per-row lane maps.
		*/
		function computeLanes(rows) {
			const later = /* @__PURE__ */ new Set();
			for (const row of rows) for (const parent of row.parents) later.add(parent);
			const lanes = [];
			const result = [];
			for (const row of rows) {
				let nodeColumn = lanes.findIndex((pending) => pending === row.oid);
				if (nodeColumn === -1) {
					lanes.push(row.oid);
					nodeColumn = lanes.length - 1;
				}
				const columns = [];
				for (let i = 0; i < lanes.length; i += 1) {
					const pending = lanes[i];
					if (pending === null) columns.push("gap");
					else if (i === nodeColumn) columns.push(row.parents.length > 1 ? "merge" : "node");
					else if (pending === row.oid) columns.push("gap");
					else if (typeof pending === "string" && later.has(pending)) columns.push("pass");
					else columns.push("gap");
				}
				const [first, ...rest] = row.parents.filter((parent) => later.has(parent));
				for (let i = 0; i < lanes.length; i += 1) if (lanes[i] === row.oid && i !== nodeColumn) lanes[i] = null;
				lanes[nodeColumn] = first ?? null;
				for (const parent of rest) if (!lanes.includes(parent)) lanes.push(parent);
				while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
				result.push({
					columns,
					nodeColumn,
					merge: row.parents.length > 1
				});
			}
			return result;
		}
		//#endregion
		//#region src/client/graph/GraphDialog.tsx
		/**
		* The Git graph panel: a read-only commit list with lane topology, ref
		* labels, and paging (git log --branches --tags --remotes --topo-order).
		* @module dsh-git-graph/client/graph/GraphDialog
		*/
		/** Initial page size of the graph fetch. */
		const INITIAL_LIMIT = 200;
		/** Page size of one "load more" step. */
		const PAGE_STEP = 100;
		/** Lane glyph → the rendered monospace character. */
		function glyphChar(glyph) {
			switch (glyph) {
				case "node": return "●";
				case "merge": return "◆";
				case "pass": return "│";
				case "gap": return " ";
			}
		}
		/** Seconds per time bucket (relative timestamps). */
		const MINUTE = 60;
		const HOUR = 60 * MINUTE;
		const DAY = 24 * HOUR;
		/**
		* A compact relative timestamp (GitHub-style): "just now", "5 分钟前",
		* falling back to a plain date past 30 days.
		* @param epochSeconds - commit author time in seconds.
		* @param t - the dictionary.
		* @returns the display string.
		*/
		function formatTime(epochSeconds, t) {
			const elapsed = Math.max(0, Math.floor(Date.now() / 1e3) - epochSeconds);
			if (elapsed < MINUTE) return t("graph.time.justNow");
			if (elapsed < HOUR) return t("graph.time.minutesAgo", { count: Math.floor(elapsed / MINUTE) });
			if (elapsed < DAY) return t("graph.time.hoursAgo", { count: Math.floor(elapsed / HOUR) });
			if (elapsed < 30 * DAY) return t("graph.time.daysAgo", { count: Math.floor(elapsed / DAY) });
			const date = /* @__PURE__ */ new Date(epochSeconds * 1e3);
			const pad = (n) => String(n).padStart(2, "0");
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
		}
		/**
		* The Git graph panel.
		* @param props - see {@link GraphDialogProps}.
		*/
		function GraphDialog({ graph, onClose, t }) {
			const [view, setView] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const requestSeq = (0, react.useRef)(0);
			const load = (0, react.useCallback)((limit) => {
				const seq = requestSeq.current + 1;
				requestSeq.current = seq;
				setLoading(true);
				graph(limit).then((next) => {
					if (seq !== requestSeq.current) return;
					setView(next);
					setError(next === null ? t("error.internal") : null);
				}).catch(() => {
					if (seq !== requestSeq.current) return;
					setError(t("error.internal"));
				}).finally(() => {
					if (seq === requestSeq.current) setLoading(false);
				});
			}, [graph, t]);
			const loadRef = (0, react.useRef)(load);
			loadRef.current = load;
			(0, react.useEffect)(() => {
				loadRef.current(INITIAL_LIMIT);
			}, []);
			const lanes = (0, react.useMemo)(() => {
				if (view === null) return [];
				return computeLanes(view.commits);
			}, [view]);
			const laneCount = (0, react.useMemo)(() => {
				let count = 0;
				for (const row of lanes) count = Math.max(count, row.columns.length);
				return count;
			}, [lanes]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Backdrop, { onClose }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: context_module_css_default.dialog,
				role: "dialog",
				"aria-label": t("graph.title"),
				"data-gitgraph-dialog": true,
				"data-dsh-plugin": "git-graph",
				"data-dsh-part": "dialog",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.dialogHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: context_module_css_default.dialogHeading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: context_module_css_default.dialogTitle,
								children: t("graph.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: context_module_css_default.graphSubtitle,
								children: t("graph.subtitle", {
									count: view === null ? 0 : view.commits.length,
									lanes: laneCount
								})
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: context_module_css_default.dialogClose,
							onClick: onClose,
							"aria-label": t("graph.close"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 16 })
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: context_module_css_default.graphBody,
						children: loading && view === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: context_module_css_default.graphEmpty,
							children: t("graph.loading")
						}) : error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: context_module_css_default.graphEmpty,
							children: error
						}) : view === null || view.commits.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: context_module_css_default.graphEmpty,
							children: t("graph.empty")
						}) : view.commits.map((commit, index) => {
							const row = lanes[index];
							if (row === void 0) return null;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: context_module_css_default.graphRow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: context_module_css_default.graphLanes,
										"aria-hidden": "true",
										"data-gitgraph-lanes": true,
										children: row.columns.map((glyph, column) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"data-gitgraph-glyph": glyph,
											className: cx(context_module_css_default.graphLaneCell, glyph === "node" && context_module_css_default.graphLaneNode, glyph === "merge" && context_module_css_default.graphLaneMerge, glyph === "pass" && context_module_css_default.graphLanePass),
											children: glyphChar(glyph)
										}, column))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: context_module_css_default.graphOid,
										title: commit.oid,
										children: commit.oid.slice(0, 7)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: context_module_css_default.graphMain,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: context_module_css_default.graphSubject,
											title: commit.subject,
											children: commit.subject
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: context_module_css_default.graphMeta,
											children: [
												commit.refs.map((ref) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													title: ref,
													"data-gitgraph-ref": true,
													"data-gitgraph-ref-current": ref === view.branch || void 0,
													className: cx(context_module_css_default.graphRef, ref === view.branch && context_module_css_default.graphRefCurrent),
													children: ref
												}, ref)),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: commit.author }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: context_module_css_default.graphMetaSep,
													children: "·"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatTime(commit.authorTime, t) })
											]
										})]
									})
								]
							}, commit.oid);
						})
					}),
					view !== null && view.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: context_module_css_default.graphMore,
						onClick: () => {
							load(view.commits.length + PAGE_STEP);
						},
						children: t("graph.loadMore")
					})
				]
			})] });
		}
		const SKIN_CENTER_BODY_ATTR = "data-dsh-skin-center";
		const DARK_THEME_BODY_ATTR = "data-ds-dark-theme";
		const DSH_BODY_ATTR_PREFIX = "data-dsh-";
		/** Whether a body attribute belongs to an applied skin rather than the skin center shell. */
		function hasAppliedSkinBodyAttr(name) {
			return name.startsWith(DSH_BODY_ATTR_PREFIX) && name !== SKIN_CENTER_BODY_ATTR;
		}
		/** Whether the page is using the unskinned stock light theme. */
		function readStockLightTheme() {
			if (typeof document === "undefined") return false;
			const body = document.body;
			if (!body.hasAttribute(SKIN_CENTER_BODY_ATTR) || body.hasAttribute(DARK_THEME_BODY_ATTR)) return false;
			return !body.getAttributeNames().some(hasAppliedSkinBodyAttr);
		}
		/** Track stock-light theme changes from body attributes. */
		function useStockLightTheme() {
			const [stockLightTheme, setStockLightTheme] = (0, react.useState)(readStockLightTheme);
			(0, react.useEffect)(() => {
				const update = () => {
					setStockLightTheme(readStockLightTheme());
				};
				update();
				if (typeof document === "undefined" || typeof MutationObserver !== "function") return void 0;
				const observer = new MutationObserver(update);
				observer.observe(document.body, { attributes: true });
				return () => {
					observer.disconnect();
				};
			}, []);
			return stockLightTheme;
		}
		function isConnectedElement(node) {
			return node instanceof HTMLElement && node.isConnected;
		}
		/**
		* Resolve the hero workspace row element that the branch chip should join
		* during the blank-session hero phase.
		*/
		function findHeroRow(anchor) {
			if (anchor === null || !anchor.isConnected) return null;
			const outlet = anchor.parentElement;
			if (outlet === null) return null;
			const prev = outlet.previousElementSibling;
			if (prev !== null && isConnectedElement(prev) && prev.className.includes("heroWorkspaceRow")) return prev;
			const rowInStack = outlet.closest("[class*=\"composerStack\"], [class*=\"composerHero\"]")?.querySelector("[class*=\"heroWorkspaceRow\"]");
			if (rowInStack !== null && isConnectedElement(rowInStack)) return rowInStack;
			if (typeof document !== "undefined") {
				const docRow = document.querySelector("[class*=\"heroWorkspaceRow\"]");
				if (docRow !== null && isConnectedElement(docRow)) return docRow;
			}
			return null;
		}
		/**
		* The git branch selector chip for blank sessions.
		* @param props - the composed entry props of whichever seat it mounted in.
		*/
		function BranchChip(props) {
			const sessionId = props.sessionId;
			const blankSession = props.useSessions((state) => {
				if (sessionId === void 0) return false;
				return state.byId?.[sessionId]?.blank === true;
			});
			const dockSeat = "session" in props && "input" in props;
			const sessionSnapshot = dockSeat ? props.session : void 0;
			const heroSeat = sessionSnapshot?.blank === true && (sessionSnapshot.openState === "open" || blankSession === true);
			const showBranchSelector = dockSeat ? heroSeat : blankSession;
			const stockLightTheme = useStockLightTheme();
			/** Repository state: undefined = loading, null = not a repository, else the snapshot. */
			const [repo, setRepo] = (0, react.useState)(void 0);
			/** Fresh branch list, fetched when the branch popover opens. */
			const [branchesView, setBranchesView] = (0, react.useState)(null);
			const [branchOpen, setBranchOpen] = (0, react.useState)(false);
			const [createOpen, setCreateOpen] = (0, react.useState)(false);
			const [graphOpen, setGraphOpen] = (0, react.useState)(false);
			const [worktreeCreateOpen, setWorktreeCreateOpen] = (0, react.useState)(false);
			const [worktreeManageOpen, setWorktreeManageOpen] = (0, react.useState)(false);
			const [heroRow, setHeroRow] = (0, react.useState)(null);
			const anchorRef = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				if (!heroSeat || repo === void 0 || repo === null) {
					setHeroRow(null);
					return;
				}
				const update = () => {
					const found = findHeroRow(anchorRef.current);
					setHeroRow((prev) => prev === found ? prev : found);
				};
				update();
				const parent = anchorRef.current?.parentElement;
				if (parent === null || parent === void 0 || typeof MutationObserver === "undefined") return void 0;
				const observer = new MutationObserver(update);
				observer.observe(parent.parentElement ?? parent, {
					childList: true,
					subtree: true
				});
				return () => {
					observer.disconnect();
				};
			}, [heroSeat, repo !== void 0 && repo !== null]);
			const refetch = (0, react.useCallback)(() => {
				let live = true;
				props.repoStatus(sessionId).then((status) => {
					if (live) setRepo(status);
				}).catch(() => {
					if (live) setRepo(null);
				});
				return () => {
					live = false;
				};
			}, [props.repoStatus, sessionId]);
			const lastFocusRefetch = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (!showBranchSelector) return void 0;
				return refetch();
			}, [showBranchSelector, refetch]);
			(0, react.useEffect)(() => {
				if (!showBranchSelector) return void 0;
				const unsubscribe = props.subscribeChanges(sessionId, () => {
					refetch();
				});
				const onFocus = () => {
					const now = Date.now();
					if (now - lastFocusRefetch.current < 5e3) return;
					lastFocusRefetch.current = now;
					refetch();
				};
				window.addEventListener("focus", onFocus);
				return () => {
					unsubscribe();
					window.removeEventListener("focus", onFocus);
				};
			}, [
				showBranchSelector,
				props.subscribeChanges,
				sessionId,
				refetch
			]);
			const closeCreate = () => {
				setCreateOpen(false);
				refetch();
			};
			(0, react.useEffect)(() => {
				if (!showBranchSelector || !branchOpen) return void 0;
				let live = true;
				setBranchesView(null);
				props.branches(sessionId).then((view) => {
					if (live) setBranchesView(view);
				});
				return () => {
					live = false;
				};
			}, [
				showBranchSelector,
				branchOpen,
				props.branches,
				sessionId
			]);
			if (!showBranchSelector || repo === void 0 || repo === null) return null;
			const openBranchPopover = () => {
				setBranchOpen((open) => !open);
			};
			const chipNode = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-gitgraph-chip-anchor": true,
				"data-dsh-plugin": "git-graph",
				"data-dsh-part": "chip",
				"data-gitgraph-stock-light": stockLightTheme || void 0,
				className: cx(context_module_css_default.anchor, heroSeat && context_module_css_default.anchorHero),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: context_module_css_default.chipWrap,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chip, {
							hero: heroSeat,
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }),
							label: repo.branch === "" ? props.t("branch.detached") : repo.branch,
							ariaLabel: props.t("chip.aria.branch"),
							open: branchOpen,
							onClick: openBranchPopover
						}), branchOpen && branchesView !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchPopover, {
							hero: heroSeat,
							view: branchesView,
							onSwitch: (branch) => props.switchBranch(sessionId, branch),
							onSwitched: refetch,
							onCreate: () => {
								setBranchOpen(false);
								setCreateOpen(true);
							},
							onGraph: () => {
								setBranchOpen(false);
								setGraphOpen(true);
							},
							onCreateWorktree: () => {
								setBranchOpen(false);
								setWorktreeCreateOpen(true);
							},
							onManageWorktrees: () => {
								setBranchOpen(false);
								setWorktreeManageOpen(true);
							},
							onClose: () => {
								setBranchOpen(false);
							},
							t: props.t
						})]
					}),
					createOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreateBranchDialog, {
						onCreate: (name) => props.createBranch(sessionId, name),
						onClose: closeCreate,
						t: props.t
					}),
					graphOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GraphDialog, {
						graph: (limit) => props.graph(sessionId, limit),
						onClose: () => {
							setGraphOpen(false);
						},
						t: props.t
					}),
					worktreeCreateOpen && branchesView !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreateWorktreeDialog, {
						branches: branchesView.branches,
						currentBranch: branchesView.branch,
						onCreate: (name, baseRef) => props.createWorktreeSession(sessionId, name, baseRef),
						onClose: () => {
							setWorktreeCreateOpen(false);
							refetch();
						},
						t: props.t
					}),
					worktreeManageOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorktreeManager, {
						fetchWorktrees: () => props.worktrees(sessionId),
						onRemove: (worktreePath, opts) => props.removeWorktree(sessionId, worktreePath, opts),
						onClose: () => {
							setWorktreeManageOpen(false);
						},
						t: props.t
					})
				]
			});
			if (heroSeat) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: anchorRef,
				style: { display: "none" }
			}), heroRow !== null && isConnectedElement(heroRow) ? (0, react_dom.createPortal)(chipNode, heroRow) : chipNode] });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: anchorRef,
				style: { display: "contents" },
				children: chipNode
			});
		}
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
		//#region src/client/auto-isolation.ts
		/** Log line prefix for every auto-isolation diagnostic. */
		const TAG = "[git-graph] auto-isolation";
		/**
		* Probe the two service shapes the wrapper needs: the navigation face that
		* owns `startSession` and the registry face that owns the workspace rows.
		* The wrapper only installs when every member it shadows or calls is a
		* function of the expected kind; a changed client-runtime surface leaves the
		* official behavior untouched.
		*
		* Both faces have been read from the live context rather than assumed:
		* 0.1.7's `workspaces` service is the registry (no `startSession`), and the
		* navigation service supplies `startSession` — reading only `workspaces`, as
		* this probe did before the split, disabled the feature on every 0.1.7 boot
		* and printed the shape warning on each page load (#1690).
		* @param navigation - the navigation service (`uiWorkspace`), or undefined.
		* @param registry - the registry service (`workspaces`), or undefined.
		* @returns the probed pair, or null when either face is unusable.
		*/
		function probeWorkspaces(navigation, registry) {
			if (typeof navigation !== "object" || navigation === null) return null;
			if (typeof registry !== "object" || registry === null) return null;
			const nav = navigation;
			const reg = registry;
			if (typeof nav.startSession !== "function") return null;
			if (typeof reg.create !== "function" || typeof reg.list?.getSnapshot !== "function") return null;
			return {
				navigation: nav,
				registry: reg
			};
		}
		/**
		* Install the startSession wrapper on the shared navigation service.
		* @param scope - client context carrying the navigation (`uiWorkspace`) and
		* registry (`workspaces`) faces plus the sessions list.
		* @param git - the /git/* client (config + worktree verbs).
		* @returns the disposer restoring the official method.
		*/
		function installAutoIsolation(scope, git) {
			const probe = probeWorkspaces(scope.uiWorkspace, scope.workspaces);
			if (probe === null) {
				console.warn(`${TAG} disabled: the uiWorkspace/workspaces service shape changed; using the official new-session behavior`);
				return () => {};
			}
			const { navigation, registry } = probe;
			let original;
			try {
				original = navigation.startSession;
			} catch {
				console.warn(`${TAG} disabled: startSession is not readable`);
				return () => {};
			}
			/**
			* The target resolution the official New Session uses (explicit > the
			* current session's workspace > the first registered workspace). The 0.1.7
			* `workspaces` snapshot carries no `recentWorkspaceId`; the first row is the
			* registry's own ordering, which the New Session default follows.
			*/
			const resolveTarget = (workspaceId) => {
				const snapshot = registry.list.getSnapshot();
				const current = mainViewSessionId(scope.sessions.list.getSnapshot().byId);
				const currentWorkspaceId = current === void 0 ? void 0 : snapshot.items.find((item) => item.sessionIds.includes(current))?.workspaceId;
				return workspaceId ?? currentWorkspaceId ?? snapshot.items[0]?.workspaceId;
			};
			/**
			* Targets with a routing flow already in flight. The new-session button
			* fires `startSession` on every click and nothing upstream debounces it, so
			* a fast double click would otherwise run two isolation flows and create two
			* worktrees; the second click is absorbed while the first is routing.
			*/
			const routing = /* @__PURE__ */ new Set();
			const routed = (workspaceId) => {
				const target = resolveTarget(workspaceId);
				if (target === void 0) {
					original.call(navigation);
					return;
				}
				if (routing.has(target)) return;
				routing.add(target);
				(async () => {
					const configResult = await git.config();
					if (!configResult.ok || !configResult.value.autoIsolate) {
						original.call(navigation, target);
						return;
					}
					const config = configResult.value;
					const item = registry.list.getSnapshot().items.find((entry) => entry.workspaceId === target);
					if (item === void 0) {
						original.call(navigation, target);
						return;
					}
					const home = config.worktreesHome;
					if (item.path.startsWith(home + "/") || item.path.startsWith(home + "\\")) {
						original.call(navigation, target);
						return;
					}
					const status = await git.status(item.path);
					if (!status.ok || status.value === null) {
						original.call(navigation, target);
						return;
					}
					const name = `s-${Date.now().toString(36)}`;
					const baseRef = config.autoBaseline === "default" ? "origin/HEAD" : void 0;
					const created = await git.addWorktree(item.path, name, baseRef);
					if (!created.ok) {
						console.warn(`${TAG} worktree creation failed; starting the session in the main checkout instead`, created.error);
						original.call(navigation, target);
						return;
					}
					let registeredId;
					try {
						const workspace = await registry.create({ path: created.value.path });
						registeredId = workspace.workspaceId;
						original.call(navigation, workspace.workspaceId);
					} catch (error) {
						if (registeredId !== void 0 && typeof registry.delete === "function") try {
							await registry.delete(registeredId);
						} catch (cleanupError) {
							console.warn(`${TAG} could not drop the failed workspace registration`, cleanupError);
						}
						await git.removeWorktree(item.path, created.value.path, { force: true });
						console.warn(`${TAG} workspace registration failed; rolled back the worktree`, error);
						original.call(navigation, target);
					}
				})().catch((error) => {
					console.warn(`${TAG} routing failed; using the official behavior`, error);
					original.call(navigation, target);
				}).finally(() => {
					routing.delete(target);
				});
			};
			try {
				navigation.startSession = routed;
			} catch {
				console.warn(`${TAG} disabled: startSession is not writable`);
				return () => {};
			}
			return () => {
				try {
					navigation.startSession = original;
				} catch {}
			};
		}
		//#endregion
		//#region src/client/locales.ts
		/** `git-graph` namespace dictionaries (branch selector + Git graph copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"branch.search": "搜索分支",
			"branch.empty": "未找到匹配分支",
			"branch.detached": "分离 HEAD",
			"branch.dirty": "未提交的更改：{count} 个文件",
			"branch.create": "创建并检出新分支…",
			"branch.graph": "Git 图谱",
			"branch.createDialog.title": "创建并检出新分支",
			"branch.createDialog.description": "基于当前 HEAD 创建一个新的本地分支，并在创建成功后立即切换过去。",
			"branch.createDialog.nameLabel": "分支名",
			"branch.createDialog.placeholder": "例如 feature/git-branch-switcher",
			"branch.createDialog.confirm": "创建并切换",
			"branch.createDialog.cancel": "取消",
			"graph.title": "Git 图谱",
			"graph.subtitle": "{count} 个提交，{lanes} 条泳道",
			"graph.loading": "加载中…",
			"graph.loadMore": "加载更多",
			"graph.close": "关闭",
			"graph.empty": "没有提交记录",
			"graph.time.justNow": "刚刚",
			"graph.time.minutesAgo": "{count} 分钟前",
			"graph.time.hoursAgo": "{count} 小时前",
			"graph.time.daysAgo": "{count} 天前",
			"error.conflictsPresent": "当前仓库还有未解决的冲突，先处理完再切换分支。",
			"error.operationInProgress": "当前仓库还有进行中的 Git 操作，完成后再切换分支。",
			"error.branchInOtherWorktree": "目标分支已在其他 worktree 中被检出，当前工作区无法直接切换。",
			"error.trackedOverwrite": "切换失败，以下已跟踪文件的修改会被目标分支覆盖：{paths}。",
			"error.untrackedOverwrite": "切换失败，以下未跟踪文件会被目标分支覆盖：{paths}。",
			"error.moreFiles": "等另外 {count} 个文件",
			"error.pathsSeparator": "、",
			"error.targetBranchNotFound": "目标分支不存在于本地仓库。",
			"error.invalidBranchName": "分支名无效，请重新输入。",
			"error.branchAlreadyExists": "分支已存在，请换一个名称。",
			"error.workspaceUnknown": "当前目录不是已注册的工作区。",
			"error.internal": "操作失败，请稍后重试。",
			"error.requestFailed": "分支操作失败：{error}",
			"toast.switchSuccess": "已切换到分支 {branchName}",
			"chip.aria.branch": "分支",
			"worktree.create": "在 worktree 中开始新会话…",
			"worktree.manage": "管理 worktree…",
			"worktree.dialog.title": "在 worktree 中开始新会话",
			"worktree.dialog.description": "在 DSH 托管目录（$DSH_HOME/worktrees/）创建隔离 worktree，携带新分支 wt/<名称>，并在其中打开新会话。当前检出不受影响。",
			"worktree.dialog.nameLabel": "worktree 名称",
			"worktree.dialog.namePlaceholder": "例如 fix-login-race",
			"worktree.dialog.baseLabel": "基线分支",
			"worktree.dialog.confirm": "创建并开始会话",
			"worktree.dialog.cancel": "取消",
			"worktree.manager.title": "Worktree 管理",
			"worktree.manager.loading": "加载中…",
			"worktree.manager.empty": "没有托管的 worktree",
			"worktree.manager.main": "主检出",
			"worktree.manager.detached": "分离 HEAD",
			"worktree.manager.remove": "删除",
			"worktree.manager.forceConfirm": "该 worktree 有未提交更改，确认强制删除？",
			"worktree.manager.forceYes": "强制删除",
			"worktree.manager.deleteBranch": "同时删除分支",
			"worktree.manager.close": "关闭",
			"toast.worktreeCreated": "已创建 worktree {name}",
			"error.invalidWorktreeName": "worktree 名称无效，请重新输入。",
			"error.worktreeAlreadyExists": "同名 worktree 或分支已存在，请换一个名称。",
			"error.worktreeDirty": "该 worktree 有未提交的更改。",
			"error.worktreeNotFound": "找不到该 worktree（可能已被删除）。",
			"error.worktreeIsMain": "主检出不能删除。",
			"error.baseRefNotFound": "基线分支或修订不存在。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"branch.search": "Search branches",
			"branch.empty": "No matching branches",
			"branch.detached": "Detached HEAD",
			"branch.dirty": "Uncommitted changes: {count} files",
			"branch.create": "Create and switch to new branch…",
			"branch.graph": "Git Graph",
			"branch.createDialog.title": "Create and switch to new branch",
			"branch.createDialog.description": "Create a new local branch from the current HEAD and switch to it immediately.",
			"branch.createDialog.nameLabel": "Branch name",
			"branch.createDialog.placeholder": "For example, feature/git-branch-switcher",
			"branch.createDialog.confirm": "Create and switch",
			"branch.createDialog.cancel": "Cancel",
			"graph.title": "Git Graph",
			"graph.subtitle": "{count} commits across {lanes} lanes",
			"graph.loading": "Loading…",
			"graph.loadMore": "Load more",
			"graph.close": "Close",
			"graph.empty": "No commits",
			"graph.time.justNow": "just now",
			"graph.time.minutesAgo": "{count} minutes ago",
			"graph.time.hoursAgo": "{count} hours ago",
			"graph.time.daysAgo": "{count} days ago",
			"error.conflictsPresent": "The repository still has unresolved conflicts. Resolve them before switching branches.",
			"error.operationInProgress": "Another Git operation is still in progress. Finish it before switching branches.",
			"error.branchInOtherWorktree": "That branch is already checked out in another worktree.",
			"error.trackedOverwrite": "Switch failed because tracked files would be overwritten: {paths}.",
			"error.untrackedOverwrite": "Switch failed because untracked files would be overwritten: {paths}.",
			"error.moreFiles": "{count} more files",
			"error.pathsSeparator": ", ",
			"error.targetBranchNotFound": "The target branch does not exist locally.",
			"error.invalidBranchName": "The branch name is invalid. Enter a different name.",
			"error.branchAlreadyExists": "That branch already exists. Choose another name.",
			"error.workspaceUnknown": "This directory is not a registered workspace.",
			"error.internal": "The operation failed. Please try again.",
			"error.requestFailed": "Branch operation failed: {error}",
			"toast.switchSuccess": "Switched to branch {branchName}",
			"chip.aria.branch": "Branch",
			"worktree.create": "Start a new session in a worktree…",
			"worktree.manage": "Manage worktrees…",
			"worktree.dialog.title": "Start a new session in a worktree",
			"worktree.dialog.description": "Create an isolated worktree in the DSH-managed home ($DSH_HOME/worktrees/) on a new wt/<name> branch, and open a new session in it. The current checkout is untouched.",
			"worktree.dialog.nameLabel": "Worktree name",
			"worktree.dialog.namePlaceholder": "For example, fix-login-race",
			"worktree.dialog.baseLabel": "Base branch",
			"worktree.dialog.confirm": "Create and start session",
			"worktree.dialog.cancel": "Cancel",
			"worktree.manager.title": "Worktree Manager",
			"worktree.manager.loading": "Loading…",
			"worktree.manager.empty": "No managed worktrees",
			"worktree.manager.main": "main checkout",
			"worktree.manager.detached": "detached HEAD",
			"worktree.manager.remove": "Remove",
			"worktree.manager.forceConfirm": "This worktree has uncommitted changes. Force-remove it?",
			"worktree.manager.forceYes": "Force remove",
			"worktree.manager.deleteBranch": "Also delete the branch",
			"worktree.manager.close": "Close",
			"toast.worktreeCreated": "Created worktree {name}",
			"error.invalidWorktreeName": "The worktree name is invalid. Enter a different name.",
			"error.worktreeAlreadyExists": "A worktree or branch with that name already exists. Choose another name.",
			"error.worktreeDirty": "The worktree has uncommitted changes.",
			"error.worktreeNotFound": "That worktree was not found (it may already be gone).",
			"error.worktreeIsMain": "The primary checkout cannot be removed.",
			"error.baseRefNotFound": "The base branch or revision does not exist."
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "git-graph";
		/** Required services: slots for the selector-context entry, sessions for the cwd lookup, workspaces for worktree sessions, locale for the copy. */
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"connection",
			"locale"
		];
		/** The session-cwd lookup failure shared by the injected verbs. */
		const NO_WORKSPACE = {
			code: "workspace-unknown",
			message: "session has no workspace"
		};
		/**
		* How long the chip waits for the selector-context declaration before
		* falling back to the input dock. The window covers the shell's first
		* render of the input selector row after the conversation service is up;
		* shells that never declare the hole (rc.6) land on the dock after it.
		*/
		const CONTEXT_FALLBACK_MS = 2e3;
		/**
		* Client plugin body: the branch chip entry with its git verbs, on the
		* selector-context hole with an input-dock fallback.
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
			}, "dsh-git-graph: dictionaries");
			const git = new GitApi();
			ctx.inject([
				"workspaces",
				"sessions",
				"uiWorkspace"
			], (worktreeScope) => {
				worktreeScope.effect(() => installAutoIsolation(worktreeScope, git), "dsh-git-graph: auto-isolation");
			});
			let fallbackTimer;
			ctx.effect(() => () => {
				if (fallbackTimer !== void 0) clearTimeout(fallbackTimer);
			}, "dsh-git-graph: context fallback timer");
			ctx.inject([
				"slots",
				"conversation",
				"sessions",
				"uiWorkspace"
			], (scope) => {
				const sessions = scope.sessions;
				/** The session's workspace root, resolved at call time from the sessions baseline. */
				const cwdOf = (sessionId) => sessionId === void 0 ? void 0 : sessions.list.getSnapshot().byId[sessionId]?.cwd;
				/** The injected face shared by every seat this chip registers into. */
				const injected = () => {
					/** Resolve the workspace root for one git call. */
					const pathOf = (sessionId) => {
						const cwd = cwdOf(sessionId);
						if (cwd === void 0 || cwd === "") return {
							ok: false,
							error: NO_WORKSPACE
						};
						return {
							ok: true,
							path: cwd
						};
					};
					return {
						repoStatus: async (sessionId) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return null;
							const result = await git.status(resolved.path);
							return result.ok ? result.value : null;
						},
						branches: async (sessionId) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return null;
							const result = await git.branches(resolved.path);
							return result.ok ? result.value : null;
						},
						switchBranch: async (sessionId, branch) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return {
								ok: false,
								error: resolved.error
							};
							const result = await git.switchBranch(resolved.path, branch);
							return result.ok ? {
								ok: true,
								branch: result.value.branch
							} : result;
						},
						createBranch: async (sessionId, name) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return {
								ok: false,
								error: resolved.error
							};
							const result = await git.createBranch(resolved.path, name);
							return result.ok ? {
								ok: true,
								branch: result.value.branch
							} : result;
						},
						graph: async (sessionId, limit) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return null;
							const result = await git.graph(resolved.path, limit);
							return result.ok ? result.value : null;
						},
						worktrees: async (sessionId) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return null;
							const result = await git.worktrees(resolved.path);
							return result.ok ? result.value : null;
						},
						createWorktreeSession: async (sessionId, name, baseRef) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return {
								ok: false,
								error: resolved.error
							};
							const created = await git.addWorktree(resolved.path, name, baseRef);
							if (!created.ok) return {
								ok: false,
								error: created.error
							};
							try {
								const workspace = await scope.workspaces.create({ path: created.value.path });
								const createdSessionId = await scope.sessions.create({ workspaceId: workspace.workspaceId });
								scope.uiWorkspace.openSession(createdSessionId);
							} catch (error) {
								await git.removeWorktree(resolved.path, created.value.path, { force: true });
								return {
									ok: false,
									error: {
										code: "internal",
										message: `workspace registration failed: ${String(error)}`
									}
								};
							}
							return {
								ok: true,
								path: created.value.path,
								branch: created.value.branch,
								name: created.value.name
							};
						},
						removeWorktree: async (sessionId, worktreePath, opts) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return {
								ok: false,
								error: resolved.error
							};
							const removed = await git.removeWorktree(resolved.path, worktreePath, opts);
							if (!removed.ok) return {
								ok: false,
								error: removed.error
							};
							const linked = scope.workspaces.list.getSnapshot().items.find((item) => item.path === worktreePath);
							if (linked !== void 0) await scope.workspaces.delete(linked.workspaceId);
							return { ok: true };
						},
						gitConfig: async () => {
							const result = await git.config();
							return result.ok ? result.value : null;
						},
						subscribeChanges: (sessionId, onChange) => {
							const resolved = pathOf(sessionId);
							if (!resolved.ok) return () => {};
							return subscribeChanges(resolved.path, onChange);
						}
					};
				};
				const chipEntry = {
					id: "git-graph",
					order: 100,
					locale: NS,
					inject: injected
				};
				let mounted = false;
				const disposeContextWait = scope.slots.inject("conversation.input.selector.context", () => {
					mounted = true;
					try {
						return scope.slots.register({
							name: "conversation.input.selector.context",
							...chipEntry
						}, BranchChip);
					} catch {
						return () => {};
					}
				});
				fallbackTimer = setTimeout(() => {
					if (mounted) return;
					disposeContextWait();
					scope.slots.inject("conversation.input.dock", () => {
						try {
							return scope.slots.register({
								name: "conversation.input.dock",
								...chipEntry
							}, BranchChip);
						} catch {
							return () => {};
						}
					});
				}, CONTEXT_FALLBACK_MS);
			});
		}
		//#endregion
		exports.BranchChip = BranchChip;
		exports.CONTEXT_FALLBACK_MS = CONTEXT_FALLBACK_MS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map