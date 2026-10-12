window.__ModuleLoader__.load({
	id: "@fish-under-sea/dsh-client-ui-model-capabilities",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/core/capabilities.ts
		/** The official adapter family this plugin extends (the card slot's key). */
		const PI_AI_SETTINGS_NAMESPACE = "llm-pi-ai";
		/** The levels a capability draft may toggle, in escalation order. */
		const THINKING_LEVELS = [
			"off",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		/**
		* Read the value at a settings path. Plain-object walk only; an absent or
		* non-object link yields undefined. (Mirrors the redacted view's shape, not
		* the host's op walker: reads never need array indexing because the whole
		* `models` array is one value.)
		*/
		function readAt(section, path) {
			let current = section;
			for (const key of path) {
				if (typeof current !== "object" || current === null || Array.isArray(current)) return void 0;
				current = current[key];
			}
			return current;
		}
		/**
		* Coerce a stored `models` value into drafts. Returns undefined when the value
		* is not an array; entries without a non-empty string id are skipped (the
		* adapter refuses them anyway, and dropping them here keeps the editor
		* renderable). Unknown fields are preserved by reference.
		*/
		function modelsArrayOf(value) {
			if (!Array.isArray(value)) return void 0;
			const entries = [];
			for (const item of value) {
				if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
				const record = item;
				if (typeof record["id"] !== "string" || record["id"].length === 0) continue;
				entries.push(record);
			}
			return entries;
		}
		/** Classify one entry's reasoning disposition for the tri-state editor. */
		function effortsModeOf(entry) {
			const efforts = entry["reasoningEfforts"];
			if (efforts === void 0) return "inherit";
			if (efforts === false) return "none";
			if (typeof efforts === "object" && efforts !== null && !Array.isArray(efforts)) return "levels";
			return "inherit";
		}
		/**
		* Normalize one entry's declared levels to wire spellings, escalation order.
		* `off` normalizes null/empty to '' ("supported, send nothing"); every other
		* declared level keeps its wire spelling (empty normalizes to '', which
		* validation reports).
		*/
		function declaredLevelsOf(entry) {
			if (effortsModeOf(entry) !== "levels") return [];
			const efforts = entry["reasoningEfforts"];
			const declared = [];
			for (const level of THINKING_LEVELS) {
				if (!(level in efforts)) continue;
				const wire = efforts[level];
				declared.push({
					level,
					wire: typeof wire === "string" ? wire : ""
				});
			}
			return declared;
		}
		/**
		* Validate one draft against the rules the pi-ai adapter enforces on apply
		* (an invalid write would be refused after the fact; this reports it before):
		* a levels dict must declare at least one level beyond `off`, and every
		* non-off level must name a non-empty wire spelling.
		*/
		function validateEntry(entry) {
			if (effortsModeOf(entry) !== "levels") return void 0;
			const declared = declaredLevelsOf(entry);
			let hasBeyondOff = false;
			for (const { level, wire } of declared) if (level !== "off") {
				hasBeyondOff = true;
				if (wire.length === 0) return {
					kind: "effortsWireMissing",
					level
				};
			}
			if (!hasBeyondOff) return { kind: "effortsOffOnly" };
		}
		/**
		* Immutable draft update: set the reasoning disposition.
		* - `inherit` drops the field.
		* - `none` writes `false`.
		* - `levels` writes a dict; toggled levels keep a previously stored wire
		*   spelling, new ones default to the identity (the level name itself). An
		*   empty dict is invalid downstream, so a fresh switch materializes the
		*   common OpenAI-style preset (low/medium/high) instead of starting empty.
		*/
		function withEffortsMode(entry, mode, levels) {
			if (mode === "inherit") {
				const { reasoningEfforts: _efforts, ...rest } = entry;
				return rest;
			}
			if (mode === "none") return {
				...entry,
				reasoningEfforts: false
			};
			const efforts = {};
			for (const level of THINKING_LEVELS) {
				if (levels === void 0 || !levels.has(level)) continue;
				efforts[level] = levels.get(level) ?? level;
			}
			return {
				...entry,
				reasoningEfforts: efforts
			};
		}
		/** The common reasoning preset a fresh levels-mode editor starts from. */
		const COMMON_EFFORTS_PRESET = [
			["low", "low"],
			["medium", "medium"],
			["high", "high"]
		];
		/**
		* Sanitize a draft for storage: drop keys whose value is undefined (JSON has
		* no undefined) and clone plain objects/arrays one level deep so later draft
		* edits cannot alias stored state. Unknown fields ride along untouched.
		*/
		function sanitizeEntry(entry) {
			const out = {};
			for (const [key, value] of Object.entries(entry)) {
				if (value === void 0) continue;
				if (typeof value === "object" && value !== null && !Array.isArray(value)) out[key] = { ...value };
				else if (Array.isArray(value)) out[key] = [...value];
				else out[key] = value;
			}
			return out;
		}
		/**
		* Build the single op a save performs: replace the provider's whole `models`
		* array. The empty path suffix works on a stored section that does not carry
		* the array yet — the walker creates the intermediate objects, and every
		* other profile field keeps inheriting from its layer.
		*/
		function buildModelsOp(settingsPath, entries) {
			return {
				op: "set",
				path: [...settingsPath, "models"],
				value: entries.map(sanitizeEntry)
			};
		}
		//#endregion
		//#region src/core/provider-toggle.ts
		/**
		* Profile entry ids this plugin's own row carries, in resolution order.
		*
		* The 0.1.7 settings surface addresses one form per ACTIVE PROFILE ENTRY ID
		* (`ctx.configForms.get(entryId)`, `settings.describe()` keyed by entry id)
		* and carries no package identity, so this plugin's own settings entry is the
		* profile row that mounts it — and that row id differs per install source: the
		* package's own cordis.patch.yml inserts `ui-model-capabilities`, while the
		* aggregate bundle namespaces every child row as `web-ui-*`
		* (scripts/aggregate.mjs) and mounts the same plugin under
		* `web-ui-model-capabilities`.
		*/
		const CAPS_ENTRY_IDS = ["ui-model-capabilities", "web-ui-model-capabilities"];
		/** Whether a value is a plain data object (not an array or null). */
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Resolve one node of a serialized schema. A schemastery `toJSON()` envelope
		* keeps every node in `refs` and refers to it by uid, so a field reference is
		* either that uid or — in a hand-built schema — the node itself.
		*/
		function schemaNode(value, refs) {
			if (isRecord(value) && typeof value["type"] === "string") return value;
			const key = isRecord(value) ? value["uid"] : value;
			if (key === void 0) return void 0;
			const node = refs[String(key)];
			return isRecord(node) ? node : void 0;
		}
		/**
		* Whether one served form schema is this plugin's own archive schema: a single
		* open-typed `disabled` field, exactly the shape the host half's Config
		* declares. Identifies this plugin's entry when the profile renamed the row.
		*/
		function isArchiveSchema(schema) {
			if (!isRecord(schema)) return false;
			const refs = isRecord(schema["refs"]) ? schema["refs"] : {};
			const root = schemaNode(schema, refs);
			if (root?.["type"] !== "object" || !isRecord(root["dict"])) return false;
			const fields = Object.keys(root["dict"]);
			if (fields.length !== 1 || fields[0] !== "disabled") return false;
			return schemaNode(root["dict"][fields[0]], refs)?.["type"] === "any";
		}
		/**
		* Resolve the served settings form that is this plugin's own settings entry:
		* the row id this deployment mounts it under, or the entry whose form schema
		* is this plugin's archive schema (a profile that renamed the row).
		* @param namespaces - every form the Host served in one describe answer.
		* @returns the entry id and its view, or undefined when nothing served is this plugin's entry.
		*/
		function resolveArchiveEntry(namespaces) {
			for (const id of CAPS_ENTRY_IDS) {
				const view = namespaces.find((form) => form.ns === id);
				if (view !== void 0) return {
					entryId: id,
					view
				};
			}
			const view = namespaces.find((form) => isArchiveSchema(form.schema));
			return view === void 0 ? void 0 : {
				entryId: view.ns,
				view
			};
		}
		/** Whether a value is a plain data object (not an array, null, or class instance). */
		function isPlainObject(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Parse the archive from the namespace's resolved value: `disabled` keyed by
		* route id. Malformed entries are skipped (a stash this plugin did not write
		* must not break the listing).
		*/
		function readDisabledStore(value) {
			const out = {};
			if (!isPlainObject(value) || !isPlainObject(value["disabled"])) return out;
			const disabled = value["disabled"];
			for (const [route, entry] of Object.entries(disabled)) {
				if (!isPlainObject(entry) || !isPlainObject(entry["profile"])) continue;
				out[route] = {
					profile: entry["profile"],
					...typeof entry["displayName"] === "string" && entry["displayName"].length > 0 ? { displayName: entry["displayName"] } : {}
				};
			}
			return out;
		}
		/** Whether one settings layer holds a profile for the route. */
		function hasProfileAt(section, route) {
			if (!isPlainObject(section) || !isPlainObject(section["providers"])) return false;
			return isPlainObject(section["providers"][route]);
		}
		/**
		* Whether a layer other than the user section holds the route, so unsetting the
		* user profile would not take the provider down. The composition `base` layer
		* answers directly when the view carries it; a view without `base` falls back
		* to "the resolved value has it but the user layer does not".
		*/
		function hasNonUserProfile(view, route) {
			if (view.base !== void 0) return hasProfileAt(view.base, route);
			return !hasProfileAt(view.user, route) && hasProfileAt(view.value, route);
		}
		/** Archive one profile: `disabled.<route> = stash` in the plugin namespace. */
		function buildStashOp(route, stash) {
			return {
				op: "set",
				path: ["disabled", route],
				value: stash
			};
		}
		/** Drop one archive entry: unset `disabled.<route>` in the plugin namespace. */
		function buildUnstashOp(route) {
			return {
				op: "unset",
				path: ["disabled", route]
			};
		}
		/** Take the route down: unset `providers.<route>` in the pi-ai namespace. */
		function buildUnsetProviderOp(route) {
			return {
				op: "unset",
				path: ["providers", route]
			};
		}
		/** Bring the route back: restore the archived profile verbatim. */
		function buildRestoreProviderOp(route, profile) {
			return {
				op: "set",
				path: ["providers", route],
				value: profile
			};
		}
		//#endregion
		//#region src/client/provider-toggle.ts
		function refused(error) {
			return {
				kind: "refused",
				message: typeof error.message === "string" && error.message.length > 0 ? error.message : error.code
			};
		}
		function failureOf(ns, error) {
			return error.code === "settings/conflict" ? {
				kind: "conflict",
				ns
			} : refused(error);
		}
		function viewOf(namespaces, ns) {
			return namespaces.find((candidate) => candidate.ns === ns);
		}
		function profileAt(userSection, route) {
			const profile = readAt(userSection, ["providers", route]);
			return typeof profile === "object" && profile !== null && !Array.isArray(profile) ? profile : void 0;
		}
		/**
		* Take one provider down: archive its user-layer profile, then unset the
		* profile so the route unregisters.
		* @param face - the settings namespace face.
		* @param llmNs - the pi-ai namespace the provider is declared in.
		* @param route - provider route id.
		* @param displayName - display name for the archive listing, when known.
		*/
		async function disableProvider(face, llmNs, route, displayName) {
			const described = await face.describe();
			if (!described.ok) return refused(described.error);
			const llmView = viewOf(described.value.namespaces, llmNs);
			const archive = resolveArchiveEntry(described.value.namespaces);
			if (llmView === void 0 || archive === void 0) return { kind: "unavailable" };
			const profile = profileAt(llmView.user, route);
			if (profile === void 0) return { kind: "no-profile" };
			if (hasNonUserProfile(llmView, route)) return { kind: "base-profile" };
			const stash = {
				profile,
				...displayName !== void 0 ? { displayName } : {}
			};
			const stashed = await face.mutate(archive.entryId, [buildStashOp(route, stash)], archive.view.revision);
			if (!stashed.ok) return failureOf(archive.entryId, stashed.error);
			const taken = await face.mutate(llmNs, [buildUnsetProviderOp(route)], llmView.revision);
			if (!taken.ok) return failureOf(llmNs, taken.error);
			return { kind: "ok" };
		}
		/**
		* Bring one provider back: restore the archived profile verbatim, then clear
		* the archive entry. Refuses when the route has grown a new profile in the
		* meantime, so an enable can never clobber newer configuration.
		* @param face - the settings namespace face.
		* @param llmNs - the pi-ai namespace the provider is declared in.
		* @param route - provider route id.
		*/
		async function enableProvider(face, llmNs, route) {
			const described = await face.describe();
			if (!described.ok) return refused(described.error);
			const llmView = viewOf(described.value.namespaces, llmNs);
			const archive = resolveArchiveEntry(described.value.namespaces);
			if (llmView === void 0 || archive === void 0) return { kind: "unavailable" };
			if (hasProfileAt(llmView.user, route)) return { kind: "route-exists" };
			const stash = readDisabledStore(archive.view.value)[route];
			if (stash === void 0) return { kind: "no-stash" };
			const restored = await face.mutate(llmNs, [buildRestoreProviderOp(route, stash.profile)], llmView.revision);
			if (!restored.ok) return failureOf(llmNs, restored.error);
			const cleared = await face.mutate(archive.entryId, [buildUnstashOp(route)], archive.view.revision);
			if (!cleared.ok) return {
				kind: "partial",
				message: cleared.error.message
			};
			return { kind: "ok" };
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* dsh-model-capabilities locale dictionaries (zh/en). The zh dictionary is
		* the key source; `en` mirrors its full key set (packages/AGENTS.md bilingual
		* discipline). Russian copy ships centrally in dsh-i18n.
		* @module @fish-under-sea/dsh-client-ui-model-capabilities/client/locales
		*/
		/** Dictionary namespace this package registers. */
		const NS = "model-caps";
		/** Chinese copy (key source). */
		const zh = {
			"caps.title": "模型能力",
			"caps.hint": "为目录里的每个模型声明推理档位，保存写入设置文档并立即生效。",
			"caps.loading": "正在读取模型能力…",
			"caps.loadFailed": "读取失败：{error}",
			"caps.reload": "重新读取",
			"caps.empty": "此提供方还没有可编辑的模型目录。先在上方模型目录中添加模型行，再回到这里为每个模型声明能力。",
			"caps.readOnly": "当前设置文档只读，无法修改。",
			"caps.model.count": "{n} 个模型",
			"caps.model.expand": "展开模型能力",
			"caps.model.collapse": "收起模型能力",
			"caps.model.efforts": "推理档位",
			"caps.efforts.inherit": "不声明",
			"caps.efforts.none": "无推理",
			"caps.efforts.levels": "声明档位",
			"caps.efforts.inheritHint": "跟随内置目录的声明；自定义模型没有目录可跟随，等同无推理。",
			"caps.efforts.noneHint": "声明该模型不参与推理（reasoningEfforts: false），模型选择器不再提供思考档位。",
			"caps.efforts.levelsHint": "勾选模型支持的档位，并填写请求里实际发送的取值。",
			"caps.wire.label": "发送值",
			"caps.wire.placeholder": "请求参数取值",
			"caps.wire.offHint": "off 可留空：表示「支持，但发送时不带参数」。",
			"caps.preset.common": "填入常用 low / medium / high",
			"caps.summary.noReasoning": "无推理",
			"caps.summary.efforts": "推理：{levels}",
			"caps.save": "保存",
			"caps.saving": "保存中…",
			"caps.discard": "重置",
			"caps.dirty": "有未保存的修改",
			"caps.saved": "已保存",
			"caps.staleDraft": "配置已被其他界面修改；你的未保存修改仍保留，保存时会再次校验。",
			"caps.conflict": "配置已被其他界面修改，已重新读取，请重试。",
			"caps.failed": "保存失败：{error}",
			"caps.invalid.wire": "档位 {level} 需要非空的发送值。",
			"caps.invalid.offOnly": "至少声明一个 off 以外的档位，或改选「无推理」。",
			"caps.action.disable": "禁用此提供方",
			"caps.action.enable": "启用",
			"caps.busy.disabling": "禁用中…",
			"caps.busy.enabling": "启用中…",
			"caps.disable.hint": "禁用后该提供方立即从输入框模型选择器与子代理可选模型中消失；配置会存档，可随时启用恢复。",
			"caps.state.badge": "已禁用",
			"caps.state.disabled": "该提供方已禁用：模型不出现在输入框模型选择器与子代理可选列表中。配置已存档，启用即恢复。",
			"caps.footer.title": "已禁用的提供方",
			"caps.footer.hint": "这些提供方的配置已存档；启用后恢复原配置，并重新出现在模型选择器与子代理可选列表中。",
			"caps.error.routeExists": "该提供方已存在新配置，无法恢复存档；请先移除现有配置再启用。",
			"caps.error.partialEnable": "已启用，但清理存档失败：{error}",
			"caps.error.baseProfile": "该提供方在组合层也声明了配置，禁用无法让它下线，因此不提供此操作。",
			"caps.error.unavailable": "无法切换：未找到插件的存档设置项。",
			"caps.seat.conflict": "「模型能力」面板未挂载：模型卡片的扩展插槽已被插件 {plugin} 占用，同一插槽只渲染一个扩展区。该插件卸载后本面板自动恢复。",
			"caps.seat.unknownPlugin": "其他插件"
		};
		/** English copy (full key parity with zh). */
		const en = {
			"caps.title": "Model capabilities",
			"caps.hint": "Declare reasoning efforts per catalog model; saving writes the settings document and applies immediately.",
			"caps.loading": "Loading model capabilities…",
			"caps.loadFailed": "Failed to load: {error}",
			"caps.reload": "Reload",
			"caps.empty": "No editable model catalog for this provider yet. Add model rows in the catalog above, then come back here to declare capabilities per model.",
			"caps.readOnly": "The settings document is read-only; changes are disabled.",
			"caps.model.count": "{n} models",
			"caps.model.expand": "Expand model capabilities",
			"caps.model.collapse": "Collapse model capabilities",
			"caps.model.efforts": "Reasoning efforts",
			"caps.efforts.inherit": "Undeclared",
			"caps.efforts.none": "No reasoning",
			"caps.efforts.levels": "Declare levels",
			"caps.efforts.inheritHint": "Follows the built-in catalog; a hand-declared model has nothing to follow, which behaves like no reasoning.",
			"caps.efforts.noneHint": "Declare this model as non-reasoning (reasoningEfforts: false); the model picker stops offering thinking levels.",
			"caps.efforts.levelsHint": "Check the levels the model supports and fill in the wire value each one sends.",
			"caps.wire.label": "Wire value",
			"caps.wire.placeholder": "request parameter value",
			"caps.wire.offHint": "off may stay empty: \"supported, but send nothing when chosen\".",
			"caps.preset.common": "Fill the common low / medium / high",
			"caps.summary.noReasoning": "no reasoning",
			"caps.summary.efforts": "reasoning: {levels}",
			"caps.save": "Save",
			"caps.saving": "Saving…",
			"caps.discard": "Reset",
			"caps.dirty": "Unsaved changes",
			"caps.saved": "Saved",
			"caps.staleDraft": "The configuration changed in another surface; your unsaved changes are kept and re-checked when you save.",
			"caps.conflict": "The configuration changed in another surface; reloaded — please retry.",
			"caps.failed": "Save failed: {error}",
			"caps.invalid.wire": "Level {level} needs a non-empty wire value.",
			"caps.invalid.offOnly": "Declare at least one level beyond off, or switch to \"No reasoning\".",
			"caps.action.disable": "Disable provider",
			"caps.action.enable": "Enable",
			"caps.busy.disabling": "Disabling…",
			"caps.busy.enabling": "Enabling…",
			"caps.disable.hint": "A disabled provider leaves the composer model picker and the subagent selection immediately; its configuration is archived and can be restored at any time.",
			"caps.state.badge": "disabled",
			"caps.state.disabled": "This provider is disabled: its models are absent from the composer picker and the subagent selection. The configuration is archived; enabling restores it.",
			"caps.footer.title": "Disabled providers",
			"caps.footer.hint": "These providers have archived configurations; enabling restores the original profile and puts it back into the model picker and the subagent selection.",
			"caps.error.routeExists": "The provider already has a newer configuration; the archive cannot be restored. Remove the current configuration first, then enable.",
			"caps.error.partialEnable": "Enabled, but clearing the archive failed: {error}",
			"caps.error.baseProfile": "The composition layer also declares this provider, so disabling cannot take it down; the action is not offered.",
			"caps.error.unavailable": "Cannot toggle: the plugin archive settings entry is not served.",
			"caps.seat.conflict": "The Model capabilities panel is not mounted: another plugin ({plugin}) holds the provider-card extension seat, which renders one extension area per provider card. The panel returns as soon as that plugin is unloaded.",
			"caps.seat.unknownPlugin": "another plugin"
		};
		/**
		* Active dictionary, picked by the document language at call time (the same
		* tiny resolution every family settings card uses).
		*/
		function dictionary() {
			return (typeof document !== "undefined" ? document.documentElement.lang : "zh").toLowerCase().startsWith("en") ? en : zh;
		}
		/** Translate a key with optional `{name}` template params; missing keys degrade to the key. */
		function t(key, params) {
			let text = dictionary()[key] ?? key;
			if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-model-capabilities/src/client/capabilities.module.css.mjs
		const css = ".j3-78W_panel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;margin:0 16px 12px;padding:0 12px}.j3-78W_header{appearance:none;box-sizing:border-box;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:8px;padding:10px 2px;display:flex}.j3-78W_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.j3-78W_title{color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:600}.j3-78W_pending{color:var(--dsw-alias-label-secondary);font-size:12px}.j3-78W_chevron{color:var(--dsw-alias-label-dimmed);flex-shrink:0;transition:transform .16s}.j3-78W_chevronOpen{transform:rotate(180deg)}.j3-78W_body{border-top:1px solid var(--dsw-alias-border-l1);flex-direction:column;gap:8px;padding:8px 2px 10px;display:flex}.j3-78W_hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:1.5}.j3-78W_status{color:var(--dsw-alias-label-dimmed);margin:0;font-size:12px;line-height:1.5}.j3-78W_readOnly{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px}.j3-78W_failed{color:var(--dsw-alias-status-danger,#d0342c);margin:0;font-size:12px;line-height:1.5}.j3-78W_notice{color:var(--dsw-alias-state-warn-label);margin:0;font-size:12px;line-height:1.5}.j3-78W_statusRow{align-items:center;gap:10px;display:flex}.j3-78W_rows{flex-direction:column;gap:6px;margin:0;padding:0;list-style:none;display:flex}.j3-78W_row{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:8px}.j3-78W_rowHeader{appearance:none;box-sizing:border-box;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:8px;align-items:center;gap:8px;padding:8px 10px;display:flex}.j3-78W_rowHeader:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.j3-78W_modelId{color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;font-size:13px;font-weight:500}.j3-78W_modelName{color:var(--dsw-alias-label-dimmed);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}.j3-78W_chips{flex-wrap:wrap;gap:4px;margin-left:auto;display:flex}.j3-78W_chip{color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 8px;font-size:11px;line-height:18px}.j3-78W_rowBody{border-top:1px solid var(--dsw-alias-border-l1);flex-direction:column;gap:12px;padding:10px;display:flex}.j3-78W_field{flex-direction:column;gap:4px;display:flex}.j3-78W_fieldLabel{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600}.j3-78W_checkLabel{color:var(--dsw-alias-label-primary);cursor:pointer;align-items:center;gap:6px;font-size:13px;display:flex}.j3-78W_checkLabel:has(input:disabled){cursor:default;opacity:.6}.j3-78W_modeGroup{flex-wrap:wrap;gap:4px;display:flex}.j3-78W_modeOption{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:8px;align-items:center;gap:6px;padding:3px 10px;font-size:12px;display:flex}.j3-78W_modeOption:has(input:disabled){cursor:default;opacity:.6}.j3-78W_modeOptionActive{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}.j3-78W_levels{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;flex-direction:column;gap:8px;padding:8px;display:flex}.j3-78W_levelChips{flex-wrap:wrap;gap:4px;display:flex}.j3-78W_levelChip{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:999px;padding:2px 10px;font-size:12px;line-height:1.4}.j3-78W_levelChip:disabled{cursor:default;opacity:.6}.j3-78W_levelChipActive{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-brand-primary-softer,transparent)}.j3-78W_wireRow{align-items:center;gap:8px;display:flex}.j3-78W_wireLabel{min-width:130px;color:var(--dsw-alias-label-secondary);align-items:center;gap:6px;font-size:12px;display:flex}.j3-78W_wireLabel code{color:var(--dsw-alias-label-primary);font-size:12px}.j3-78W_wireInput{appearance:none;font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;flex:1;min-width:0;padding:4px 8px;font-size:12px}.j3-78W_wireInput:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px}.j3-78W_wireInput::placeholder{color:var(--dsw-alias-label-dimmed)}.j3-78W_footer{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.j3-78W_spacer{flex:1}.j3-78W_ghost{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0;border-radius:8px;padding:4px 12px;font-size:13px;line-height:1.5}.j3-78W_ghost:disabled{opacity:.4;cursor:default}.j3-78W_ghost:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.j3-78W_primary{appearance:none;font:inherit;cursor:pointer;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid #0000;border-radius:8px;padding:4px 14px;font-size:13px;line-height:1.5}.j3-78W_primary:hover:enabled{background:var(--dsw-alias-button-primary-hover)}.j3-78W_primary:disabled{opacity:.4;cursor:default}.j3-78W_primary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.j3-78W_offBadge{color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 8px;font-size:11px;line-height:18px}.j3-78W_disabledBox{border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;align-items:center;gap:10px;padding:10px;display:flex}.j3-78W_disabledBox p{flex:1}.j3-78W_danger{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-status-danger,#d0342c);color:var(--dsw-alias-status-danger,#d0342c);background:0 0;border-radius:8px;padding:4px 12px;font-size:13px;line-height:1.5}.j3-78W_danger:disabled{opacity:.4;cursor:default}.j3-78W_danger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.j3-78W_archive{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:8px;padding:10px 12px;display:flex}.j3-78W_archiveTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;font-weight:600}.j3-78W_archiveRows{flex-direction:column;gap:4px;margin:0;padding:0;list-style:none;display:flex}.j3-78W_archiveRow{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:8px;align-items:center;gap:8px;padding:6px 10px;display:flex}";
		const tagId = "@fish-under-sea/dsh-client-ui-model-capabilities/packages/dsh-client-ui-model-capabilities/src/client/capabilities.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@fish-under-sea/dsh-client-ui-model-capabilities";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var capabilities_module_css_default = {
			"archive": "j3-78W_archive",
			"archiveRow": "j3-78W_archiveRow",
			"archiveRows": "j3-78W_archiveRows",
			"archiveTitle": "j3-78W_archiveTitle",
			"body": "j3-78W_body",
			"checkLabel": "j3-78W_checkLabel",
			"chevron": "j3-78W_chevron",
			"chevronOpen": "j3-78W_chevronOpen",
			"chip": "j3-78W_chip",
			"chips": "j3-78W_chips",
			"danger": "j3-78W_danger",
			"disabledBox": "j3-78W_disabledBox",
			"failed": "j3-78W_failed",
			"field": "j3-78W_field",
			"fieldLabel": "j3-78W_fieldLabel",
			"footer": "j3-78W_footer",
			"ghost": "j3-78W_ghost",
			"header": "j3-78W_header",
			"hint": "j3-78W_hint",
			"levelChip": "j3-78W_levelChip",
			"levelChipActive": "j3-78W_levelChipActive",
			"levelChips": "j3-78W_levelChips",
			"levels": "j3-78W_levels",
			"modeGroup": "j3-78W_modeGroup",
			"modeOption": "j3-78W_modeOption",
			"modeOptionActive": "j3-78W_modeOptionActive",
			"modelId": "j3-78W_modelId",
			"modelName": "j3-78W_modelName",
			"notice": "j3-78W_notice",
			"offBadge": "j3-78W_offBadge",
			"panel": "j3-78W_panel",
			"pending": "j3-78W_pending",
			"primary": "j3-78W_primary",
			"readOnly": "j3-78W_readOnly",
			"row": "j3-78W_row",
			"rowBody": "j3-78W_rowBody",
			"rowHeader": "j3-78W_rowHeader",
			"rows": "j3-78W_rows",
			"spacer": "j3-78W_spacer",
			"status": "j3-78W_status",
			"statusRow": "j3-78W_statusRow",
			"title": "j3-78W_title",
			"wireInput": "j3-78W_wireInput",
			"wireLabel": "j3-78W_wireLabel",
			"wireRow": "j3-78W_wireRow"
		};
		//#endregion
		//#region src/client/CapabilitiesPanel.tsx
		/**
		* Models-page provider-card extension area: per-model capability declarations
		* and the provider disable/enable toggle for one pi-ai provider route.
		*
		* The slot owner passes the card's directory row (`provider.settingsNs` /
		* `provider.settingsPath` address the profile inside the settings document)
		* and the apply body injects the settings namespace face plus the refresh
		* bus; this panel reads the redacted entry views over the remote settings
		* wire, drafts reasoning-effort declarations per model, and saves them as one
		* whole-array path op with revision fencing — the same write granularity and
		* conflict posture the official card uses. Model input types belong to the
		* Models page's own editor since 0.1.6-alpha.2, so the draft preserves the
		* `input` claim instead of rewriting it.
		*
		* The toggle uses this plugin's own settings entry: disabling stashes the
		* user-layer profile and unsets `providers.<route>` (the official
		* Remove-provider seam), which takes the provider out of the model catalog
		* both pickers read; enabling restores it. A missing entry or a refused
		* read renders the failure inline, never a blank.
		* @module @fish-under-sea/dsh-client-ui-model-capabilities/client/CapabilitiesPanel
		*/
		/** Extract a display text from a remote failure (the host diagnostic, or its code). */
		function failureText(error) {
			return typeof error.message === "string" && error.message.length > 0 ? error.message : error.code;
		}
		/** Deep-clone one entry through JSON so draft edits never alias stored state. */
		function cloneEntry(entry) {
			return JSON.parse(JSON.stringify(sanitizeEntry(entry)));
		}
		/**
		* Render the capability editor for one provider card.
		* @param props - the card's directory row, its configured facts, and the injected faces.
		* @returns the extension area.
		*/
		function CapabilitiesPanel(props) {
			const { provider, settings, refresh } = props;
			const [phase, setPhase] = (0, react.useState)({ kind: "loading" });
			const [snapshot, setSnapshot] = (0, react.useState)(void 0);
			const [draft, setDraft] = (0, react.useState)(null);
			const [expandedId, setExpandedId] = (0, react.useState)(null);
			const [open, setOpen] = (0, react.useState)(false);
			const [save, setSave] = (0, react.useState)({ kind: "idle" });
			const [toggleBusy, setToggleBusy] = (0, react.useState)(void 0);
			const [toggleFailure, setToggleFailure] = (0, react.useState)(void 0);
			const [toggleConflict, setToggleConflict] = (0, react.useState)(false);
			const [staleDraft, setStaleDraft] = (0, react.useState)(false);
			/** Revision the open draft was read from (the write's fence while it is open). */
			const draftBasis = (0, react.useRef)(void 0);
			const settingsPath = (0, react.useMemo)(() => [...provider.settingsPath], [provider.settingsPath]);
			/** The models array lives one level below the profile the settings path addresses. */
			const modelsPath = (0, react.useMemo)(() => [...settingsPath, "models"], [settingsPath]);
			const entries = draft ?? snapshot?.entries ?? [];
			const load = (0, react.useCallback)(async (face) => {
				setPhase({ kind: "loading" });
				try {
					const described = await face.describe();
					if (!described.ok) throw new Error(failureText(described.error));
					const namespaces = described.value.namespaces;
					const view = namespaces.find((candidate) => candidate.ns === provider.settingsNs);
					if (view === void 0) throw new Error(`settings entry "${provider.settingsNs}" is not served on this host`);
					const archive = resolveArchiveEntry(namespaces);
					const stash = readDisabledStore(archive?.view.value);
					const userProfile = hasProfileAt(view.user, provider.provider);
					const userModels = modelsArrayOf(readAt(view.user, modelsPath));
					const effective = userModels ?? modelsArrayOf(readAt(view.value, modelsPath)) ?? [];
					const basis = draftBasis.current;
					setSnapshot({
						entries: effective,
						inherited: userModels === void 0,
						revision: basis ?? view.revision,
						writable: described.value.writable,
						userProfile,
						baseProfile: hasNonUserProfile(view, provider.provider),
						disabledHere: stash[provider.provider] !== void 0 && !userProfile,
						capsKnown: archive !== void 0
					});
					if (basis === void 0) setDraft(null);
					setStaleDraft(basis !== void 0 && basis !== view.revision);
					setPhase({ kind: "ready" });
				} catch (error) {
					setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}, [
				modelsPath,
				provider.provider,
				provider.settingsNs
			]);
			(0, react.useEffect)(() => {
				load(settings);
			}, [load, settings]);
			(0, react.useEffect)(() => {
				return refresh?.subscribe(() => {
					load(settings);
				});
			}, [
				load,
				refresh,
				settings
			]);
			const editing = phase.kind === "ready" && snapshot !== void 0;
			const readOnly = editing && !snapshot.writable;
			const dirty = draft !== null;
			const disabledHere = editing && snapshot.disabledHere;
			const toggleUnavailable = !editing || !snapshot.capsKnown || readOnly || toggleBusy !== void 0;
			const updateEntry = (index, next) => {
				if (!editing || readOnly) return;
				if (draft === null) draftBasis.current = snapshot.revision;
				setDraft((current) => {
					const clone = (current ?? snapshot.entries.map(cloneEntry)).map((entry) => ({ ...entry }));
					clone[index] = next;
					return clone;
				});
				setSave({ kind: "idle" });
			};
			const discard = () => {
				draftBasis.current = void 0;
				setStaleDraft(false);
				setDraft(null);
				setSave({ kind: "idle" });
			};
			const firstIssue = (0, react.useMemo)(() => {
				for (const entry of draft ?? []) {
					const issue = validateEntry(entry);
					if (issue !== void 0) return issue;
				}
			}, [draft]);
			const doSave = async () => {
				if (!editing || readOnly || draft === null || snapshot === void 0) return;
				if (firstIssue !== void 0) return;
				const op = buildModelsOp(settingsPath, draft);
				setSave({ kind: "saving" });
				try {
					const written = await settings.mutate(provider.settingsNs, [op], snapshot.revision);
					if (written.ok) {
						const userModels = modelsArrayOf(readAt(written.value.user, modelsPath)) ?? [];
						setSnapshot((current) => current === void 0 ? current : {
							...current,
							entries: userModels,
							inherited: false,
							revision: written.value.revision,
							userProfile: true
						});
						draftBasis.current = void 0;
						setStaleDraft(false);
						setDraft(null);
						setSave({ kind: "saved" });
						return;
					}
					if (written.error.code === "settings/conflict") {
						draftBasis.current = void 0;
						setStaleDraft(false);
						setSave({ kind: "conflict" });
						await load(settings);
						return;
					}
					setSave({
						kind: "failed",
						message: failureText(written.error)
					});
				} catch (error) {
					setSave({
						kind: "failed",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const applyToggleOutcome = async (outcome) => {
				if (outcome.kind === "ok") {
					setToggleFailure(void 0);
					setToggleConflict(false);
					refresh?.notify();
					await load(settings);
					return;
				}
				if (outcome.kind === "conflict") {
					setToggleFailure(void 0);
					setToggleConflict(true);
					await load(settings);
					return;
				}
				if (outcome.kind === "route-exists") setToggleFailure(t("caps.error.routeExists"));
				else if (outcome.kind === "base-profile") setToggleFailure(t("caps.error.baseProfile"));
				else if (outcome.kind === "unavailable") setToggleFailure(t("caps.error.unavailable"));
				else if (outcome.kind === "partial") setToggleFailure(t("caps.error.partialEnable", { error: outcome.message }));
				else setToggleFailure(t("caps.failed", { error: outcome.kind }));
				await load(settings);
			};
			const doDisable = async () => {
				if (toggleUnavailable || snapshot === void 0 || !snapshot.userProfile || snapshot.baseProfile) return;
				setToggleBusy("disabling");
				setToggleFailure(void 0);
				setToggleConflict(false);
				try {
					await applyToggleOutcome(await disableProvider(settings, provider.settingsNs, provider.provider, provider.displayName));
				} finally {
					setToggleBusy(void 0);
				}
			};
			const doEnable = async () => {
				if (toggleUnavailable) return;
				setToggleBusy("enabling");
				setToggleFailure(void 0);
				setToggleConflict(false);
				try {
					await applyToggleOutcome(await enableProvider(settings, provider.settingsNs, provider.provider));
				} finally {
					setToggleBusy(void 0);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: capabilities_module_css_default.panel,
				"data-dsh-plugin": "model-capabilities",
				"data-dsh-part": "panel",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: capabilities_module_css_default.header,
					"aria-expanded": open,
					"data-dsh-part": "toggle",
					onClick: () => {
						setOpen(!open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: capabilities_module_css_default.title,
							children: t("caps.title")
						}),
						disabledHere ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: capabilities_module_css_default.offBadge,
							children: t("caps.state.badge")
						}) : null,
						dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: capabilities_module_css_default.pending,
							children: t("caps.dirty")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "12",
							height: "12",
							viewBox: "0 0 14 14",
							fill: "none",
							"aria-hidden": "true",
							className: open ? `${capabilities_module_css_default.chevron} ${capabilities_module_css_default.chevronOpen}` : capabilities_module_css_default.chevron,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M2.5 5l4.5 4.5L11.5 5",
								stroke: "currentColor",
								strokeWidth: "1.5",
								fill: "none"
							})
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: capabilities_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: capabilities_module_css_default.hint,
							children: t("caps.hint")
						}),
						phase.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: capabilities_module_css_default.status,
							role: "status",
							children: t("caps.loading")
						}) : null,
						phase.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: capabilities_module_css_default.statusRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: capabilities_module_css_default.failed,
								role: "alert",
								children: t("caps.loadFailed", { error: phase.message })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: capabilities_module_css_default.ghost,
								"data-dsh-part": "reload",
								onClick: () => {
									load(settings);
								},
								children: t("caps.reload")
							})]
						}) : null,
						phase.kind === "ready" && snapshot !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [disabledHere ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: capabilities_module_css_default.disabledBox,
							"data-dsh-part": "disabled-state",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: capabilities_module_css_default.status,
								role: "status",
								children: t("caps.state.disabled")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: capabilities_module_css_default.ghost,
								"data-dsh-part": "enable",
								disabled: toggleUnavailable,
								onClick: () => {
									doEnable();
								},
								children: toggleBusy === "enabling" ? t("caps.busy.enabling") : t("caps.action.enable")
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [readOnly ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: capabilities_module_css_default.readOnly,
							role: "status",
							children: t("caps.readOnly")
						}) : null, snapshot.entries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: capabilities_module_css_default.status,
							role: "status",
							children: t("caps.empty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: capabilities_module_css_default.rows,
							children: entries.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelRow, {
								entry,
								expanded: expandedId === entry.id,
								disabled: readOnly,
								onToggle: () => {
									setExpandedId(expandedId === entry.id ? null : entry.id);
								},
								onChange: (next) => {
									updateEntry(index, next);
								}
							}, typeof entry.id === "string" ? entry.id : index))
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: capabilities_module_css_default.footer,
							children: [
								staleDraft ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: capabilities_module_css_default.notice,
									role: "status",
									children: t("caps.staleDraft")
								}) : null,
								save.kind === "saved" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: capabilities_module_css_default.status,
									role: "status",
									children: t("caps.saved")
								}) : null,
								save.kind === "conflict" || toggleConflict ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: capabilities_module_css_default.failed,
									role: "alert",
									children: t("caps.conflict")
								}) : null,
								save.kind === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: capabilities_module_css_default.failed,
									role: "alert",
									children: t("caps.failed", { error: save.message })
								}) : null,
								toggleFailure !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: capabilities_module_css_default.failed,
									role: "alert",
									children: toggleFailure
								}) : null,
								firstIssue?.kind === "effortsWireMissing" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: capabilities_module_css_default.failed,
									role: "alert",
									children: t("caps.invalid.wire", { level: firstIssue.level })
								}) : null,
								firstIssue?.kind === "effortsOffOnly" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: capabilities_module_css_default.failed,
									role: "alert",
									children: t("caps.invalid.offOnly")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: capabilities_module_css_default.spacer }),
								!disabledHere && snapshot.userProfile && !snapshot.baseProfile && snapshot.capsKnown ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: capabilities_module_css_default.danger,
									"data-dsh-part": "disable",
									title: t("caps.disable.hint"),
									disabled: toggleUnavailable || dirty,
									onClick: () => {
										doDisable();
									},
									children: toggleBusy === "disabling" ? t("caps.busy.disabling") : t("caps.action.disable")
								}) : null,
								!disabledHere ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: capabilities_module_css_default.ghost,
									"data-dsh-part": "reset",
									disabled: !dirty || save.kind === "saving",
									onClick: discard,
									children: t("caps.discard")
								}) : null,
								!disabledHere ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: capabilities_module_css_default.primary,
									"data-dsh-part": "save",
									disabled: !dirty || readOnly || save.kind === "saving" || firstIssue !== void 0,
									onClick: () => {
										doSave();
									},
									children: save.kind === "saving" ? t("caps.saving") : t("caps.save")
								}) : null
							]
						})] }) : null
					]
				}) : null]
			});
		}
		/**
		* One model row: a collapsed summary header (reasoning levels) and the
		* expanded tri-state editor with per-level wire spellings.
		*/
		function ModelRow(props) {
			const { entry, expanded, disabled, onToggle, onChange } = props;
			const radioName = (0, react.useId)();
			const mode = effortsModeOf(entry);
			const levels = declaredLevelsOf(entry);
			/** Stored wire map (editors toggle against it). */
			const storedLevels = () => new Map(levels.map(({ level, wire }) => [level, wire]));
			const setEffortsMode = (next) => {
				if (next === "levels") {
					const stored = storedLevels();
					if (stored.size === 0) for (const [level, wire] of COMMON_EFFORTS_PRESET) stored.set(level, wire);
					onChange(withEffortsMode(entry, "levels", stored));
					return;
				}
				onChange(withEffortsMode(entry, next));
			};
			const toggleLevel = (level) => {
				const stored = storedLevels();
				if (stored.has(level)) stored.delete(level);
				else stored.set(level, level === "off" ? "" : level);
				onChange(withEffortsMode(entry, "levels", stored));
			};
			const setWire = (level, wire) => {
				const stored = storedLevels();
				stored.set(level, wire);
				onChange(withEffortsMode(entry, "levels", stored));
			};
			const applyCommonPreset = () => {
				onChange(withEffortsMode(entry, "levels", new Map(COMMON_EFFORTS_PRESET.map(([level, wire]) => [level, wire]))));
			};
			const summaryChips = [];
			if (mode === "none") summaryChips.push(t("caps.summary.noReasoning"));
			else if (mode === "levels") {
				const named = levels.filter(({ level }) => level !== "off").map(({ level }) => level);
				if (named.length > 0) summaryChips.push(t("caps.summary.efforts", { levels: named.join("/") }));
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: capabilities_module_css_default.row,
				"data-dsh-part": "model-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: capabilities_module_css_default.rowHeader,
					"aria-expanded": expanded,
					"aria-label": `${t(expanded ? "caps.model.collapse" : "caps.model.expand")}: ${entry.id}`,
					"data-dsh-part": "model-toggle",
					onClick: onToggle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: capabilities_module_css_default.modelId,
							children: entry.id
						}),
						typeof entry.name === "string" && entry.name.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: capabilities_module_css_default.modelName,
							children: entry.name
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: capabilities_module_css_default.chips,
							children: summaryChips.map((chip) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: capabilities_module_css_default.chip,
								children: chip
							}, chip))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "12",
							height: "12",
							viewBox: "0 0 14 14",
							fill: "none",
							"aria-hidden": "true",
							className: expanded ? `${capabilities_module_css_default.chevron} ${capabilities_module_css_default.chevronOpen}` : capabilities_module_css_default.chevron,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M2.5 5l4.5 4.5L11.5 5",
								stroke: "currentColor",
								strokeWidth: "1.5",
								fill: "none"
							})
						})
					]
				}), expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: capabilities_module_css_default.rowBody,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: capabilities_module_css_default.field,
						"data-dsh-part": "efforts-mode",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: capabilities_module_css_default.fieldLabel,
								children: t("caps.model.efforts")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: capabilities_module_css_default.modeGroup,
								role: "radiogroup",
								"aria-label": t("caps.model.efforts"),
								children: [
									[
										"inherit",
										t("caps.efforts.inherit"),
										t("caps.efforts.inheritHint")
									],
									[
										"none",
										t("caps.efforts.none"),
										t("caps.efforts.noneHint")
									],
									[
										"levels",
										t("caps.efforts.levels"),
										t("caps.efforts.levelsHint")
									]
								].map(([value, label, hint]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: mode === value ? `${capabilities_module_css_default.modeOption} ${capabilities_module_css_default.modeOptionActive}` : capabilities_module_css_default.modeOption,
									title: hint,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "radio",
										name: `${radioName}-efforts`,
										value,
										checked: mode === value,
										disabled,
										onChange: () => {
											setEffortsMode(value);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
								}, value))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: capabilities_module_css_default.hint,
								children: mode === "inherit" ? t("caps.efforts.inheritHint") : mode === "none" ? t("caps.efforts.noneHint") : t("caps.efforts.levelsHint")
							})
						]
					}), mode === "levels" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: capabilities_module_css_default.levels,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: capabilities_module_css_default.ghost,
								disabled,
								onClick: applyCommonPreset,
								children: t("caps.preset.common")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: capabilities_module_css_default.levelChips,
								children: THINKING_LEVELS.map((level) => {
									const active = levels.some(({ level: declared }) => declared === level);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: active ? `${capabilities_module_css_default.levelChip} ${capabilities_module_css_default.levelChipActive}` : capabilities_module_css_default.levelChip,
										"aria-pressed": active,
										disabled,
										onClick: () => {
											toggleLevel(level);
										},
										children: level
									}, level);
								})
							}),
							levels.map(({ level, wire }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: capabilities_module_css_default.wireRow,
								"data-dsh-part": "wire-input",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: capabilities_module_css_default.wireLabel,
									htmlFor: `${radioName}-wire-${level}`,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: level }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("caps.wire.label") })]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: `${radioName}-wire-${level}`,
									className: capabilities_module_css_default.wireInput,
									type: "text",
									value: wire,
									placeholder: level,
									disabled,
									onChange: (event) => {
										setWire(level, event.target.value);
									}
								})]
							}, level)),
							levels.some(({ level }) => level === "off") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: capabilities_module_css_default.hint,
								children: t("caps.wire.offHint")
							}) : null
						]
					}) : null]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/DisabledProvidersFooter.tsx
		/**
		* Models-page footer extension area: the disabled-provider archive listing.
		*
		* A disabled provider's route is unregistered, so for hand-declared routes
		* the provider card itself disappears from the Models page; this footer (the
		* page's `settings.models.footer` seat) is where those providers come back:
		* it lists the archive entries whose route is still down and restores a profile
		* on enable. Renders nothing while no such entry exists.
		* @module @fish-under-sea/dsh-client-ui-model-capabilities/client/DisabledProvidersFooter
		*/
		/**
		* Whether the route is configured again, which makes its archive entry stale:
		* an entry whose provider came back (a re-added route, or a partial enable that
		* restored the profile but failed to clear the archive) must not be listed as
		* disabled. The entry itself stays in the archive as a restorable profile.
		*/
		function routeLive(view, route) {
			if (view === void 0) return false;
			return hasProfileAt(view.user, route) || hasNonUserProfile(view, route);
		}
		/**
		* Render the disabled-provider archive.
		* @param props - the injected settings face, refresh bus and card-seat claim status.
		* @returns the footer area, the card-collision notice on its own, or nothing while neither applies.
		*/
		function DisabledProvidersFooter(props) {
			const { settings, refresh, cardSeat } = props;
			const claim = (0, react.useSyncExternalStore)(cardSeat.subscribe, cardSeat.getSnapshot);
			const [stash, setStash] = (0, react.useState)({});
			const [llmView, setLlmView] = (0, react.useState)(void 0);
			const [known, setKnown] = (0, react.useState)(false);
			const [busyRoute, setBusyRoute] = (0, react.useState)(void 0);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const load = (0, react.useCallback)(async (face) => {
				try {
					const described = await face.describe();
					if (!described.ok) return;
					const archive = resolveArchiveEntry(described.value.namespaces);
					if (archive === void 0) return;
					setStash(readDisabledStore(archive.view.value));
					setLlmView(described.value.namespaces.find((candidate) => candidate.ns === PI_AI_SETTINGS_NAMESPACE));
					setKnown(true);
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				load(settings);
			}, [load, settings]);
			(0, react.useEffect)(() => {
				return refresh.subscribe(() => {
					load(settings);
				});
			}, [
				load,
				refresh,
				settings
			]);
			const routes = Object.keys(stash).filter((route) => !routeLive(llmView, route)).sort((a, b) => a.localeCompare(b));
			const archived = known && routes.length > 0;
			if (!archived && claim.kind !== "conflict") return null;
			const enable = async (route) => {
				if (busyRoute !== void 0) return;
				setBusyRoute(route);
				setFailure(void 0);
				try {
					const outcome = await enableProvider(settings, PI_AI_SETTINGS_NAMESPACE, route);
					if (outcome.kind === "ok") {
						refresh.notify();
						await load(settings);
						return;
					}
					if (outcome.kind === "conflict") {
						setFailure(t("caps.conflict"));
						await load(settings);
						return;
					}
					if (outcome.kind === "route-exists") setFailure(t("caps.error.routeExists"));
					else if (outcome.kind === "unavailable") setFailure(t("caps.error.unavailable"));
					else if (outcome.kind === "partial") setFailure(t("caps.error.partialEnable", { error: outcome.message }));
					else setFailure(t("caps.failed", { error: outcome.kind }));
				} finally {
					setBusyRoute(void 0);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: capabilities_module_css_default.archive,
				"data-dsh-plugin": "model-capabilities",
				"data-dsh-part": "disabled-footer",
				children: [
					claim.kind === "conflict" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: capabilities_module_css_default.failed,
						role: "alert",
						children: t("caps.seat.conflict", { plugin: claim.occupant ?? t("caps.seat.unknownPlugin") })
					}) : null,
					archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: capabilities_module_css_default.archiveTitle,
							children: t("caps.footer.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: capabilities_module_css_default.archiveRows,
							children: routes.map((route) => {
								const entry = stash[route];
								const name = entry.displayName !== void 0 && entry.displayName.length > 0 ? entry.displayName : route;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									className: capabilities_module_css_default.archiveRow,
									"data-dsh-part": "disabled-row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: capabilities_module_css_default.modelId,
											children: name
										}),
										name !== route ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: capabilities_module_css_default.modelName,
											children: route
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: capabilities_module_css_default.spacer }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: capabilities_module_css_default.ghost,
											"data-dsh-part": "enable",
											disabled: busyRoute !== void 0,
											onClick: () => {
												enable(route);
											},
											children: busyRoute === route ? t("caps.busy.enabling") : t("caps.action.enable")
										})
									]
								}, route);
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: capabilities_module_css_default.hint,
							children: t("caps.footer.hint")
						})
					] }) : null,
					failure !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: capabilities_module_css_default.failed,
						role: "alert",
						children: failure
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/provider-card-seat.ts
		/**
		* The Models page's provider-card seat claim for the pi-ai adapter family.
		*
		* `settings.models.provider-card` is a KEYED slot: the Models page dispatches
		* one extension area per provider settings namespace, and a cell renders
		* exactly one entry. The core registry refuses a second registration into an
		* occupied cell (same key, same priority) by throwing — the right default, but
		* it makes the loser of a collision silently invisible unless it reports the
		* refusal. Two unrelated plugins that both extend pi-ai provider cards (this
		* one and a third-party auth plugin, for example) therefore cannot both
		* render, and the reporter must be able to see that.
		*
		* This module owns that outcome so it is never a silent blank:
		*
		* - a refused claim is classified and reported (console plus a status the
		*   Models page renders), naming the registrant that holds the cell;
		* - the claim is retried on every change to that slot, so disabling the
		*   occupying plugin restores this panel without a DSH restart;
		* - the retry subscription lives inside the injected declaration's lifetime,
		*   so fiber unload and declaration collapse both release it.
		*
		* The panel deliberately keeps the default priority rather than picking a
		* distinct one: entries sharing a cell at DIFFERENT priorities coexist on the
		* ledger but only the lowest renders, which would replace a loud collision
		* with a silent shadowing of the other plugin.
		*
		* The shared tree has no client-SDK dependency, so this module reads its
		* context through the structural shape below; callers pass the plugin's own
		* `ctx`.
		* @module @fish-under-sea/dsh-client-ui-model-capabilities/client/provider-card-seat
		*/
		/** The Models page seat this plugin fills for pi-ai provider cards. */
		const PROVIDER_CARD_SEAT = "settings.models.provider-card";
		/** The adapter-family settings namespace whose cards carry the panel. */
		const PI_AI_PROVIDER_CARD_KEY = "llm-pi-ai";
		/**
		* The registry's diagnostics label of whoever holds the pi-ai cell.
		*
		* Best-effort by design: a registry that refuses the inspection still lets the
		* refusal be reported, just without the occupant's name.
		* @param ctx - client context owning the registry.
		* @returns the occupant's label, or undefined when unknown or absent.
		*/
		function providerCardOccupant(ctx) {
			let entries;
			try {
				entries = ctx.slots.entries(PROVIDER_CARD_SEAT);
			} catch {
				return;
			}
			for (const entry of entries) {
				const view = entry;
				if (view?.options?.key === "llm-pi-ai") return view.registrant;
			}
		}
		/**
		* Claim the pi-ai provider-card cell: report a refusal instead of swallowing
		* it, and take the cell back as soon as it is released.
		* @param ctx - client context (its slot registry owns the cell).
		* @param seat - the panel contribution.
		* @returns observable claim status for a user-visible notice.
		*/
		function claimProviderCardSeat(ctx, seat) {
			let status = { kind: "unclaimed" };
			const listeners = /* @__PURE__ */ new Set();
			/** Publish a status change to every subscriber (stable reference between them). */
			const publish = (next) => {
				if (next.kind === status.kind && (next.kind !== "conflict" || next.occupant === (status.kind === "conflict" ? status.occupant : void 0))) return;
				status = next;
				for (const listener of [...listeners]) listener();
			};
			/** Report a refused claim instead of leaving the panel silently missing. */
			const reportRefusal = (occupant, error) => {
				const holder = occupant === void 0 ? "another plugin" : `"${occupant}"`;
				try {
					console.error(`[dsh-model-capabilities] provider-card slot "${PROVIDER_CARD_SEAT}" key "${PI_AI_PROVIDER_CARD_KEY}" is held by ${holder}, so the model capabilities panel is not rendered; disable that plugin to restore it`, error);
				} catch {}
			};
			/** One attempt at the cell; its disposer, or undefined when refused. */
			const tryClaim = () => {
				try {
					const unregister = ctx.slots.register({
						name: PROVIDER_CARD_SEAT,
						key: PI_AI_PROVIDER_CARD_KEY,
						...seat.inject === void 0 ? {} : { inject: seat.inject }
					}, seat.component);
					publish({ kind: "claimed" });
					return () => {
						unregister();
						publish({ kind: "unclaimed" });
					};
				} catch (error) {
					const occupant = providerCardOccupant(ctx);
					reportRefusal(occupant, error);
					publish({
						kind: "conflict",
						occupant
					});
					return;
				}
			};
			/**
			* Wait for the occupant to release the cell, then claim it. The registry
			* notifies per mutation, so a claim that is still refused simply waits for
			* the next change; nothing polls.
			*
			* The `claiming` latch is required, not defensive: the registry emits that
			* notification synchronously from inside `register`, so without it the
			* claim would re-enter itself while its own entry is being written and
			* collide with the entry it is writing.
			*/
			const watchForReleasedCell = () => {
				if (typeof ctx.slots.subscribe !== "function") return () => {};
				let stopped = false;
				let claiming = false;
				let claimed;
				let unsubscribe = () => {};
				const claim = () => {
					if (stopped || claiming || claimed !== void 0) return;
					claiming = true;
					const release = tryClaim();
					claiming = false;
					if (release === void 0) return;
					claimed = release;
					unsubscribe();
				};
				unsubscribe = ctx.slots.subscribe(PROVIDER_CARD_SEAT, claim);
				return () => {
					stopped = true;
					unsubscribe();
					claimed?.();
					publish({ kind: "unclaimed" });
				};
			};
			ctx.slots.inject(PROVIDER_CARD_SEAT, () => tryClaim() ?? watchForReleasedCell());
			return {
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				getSnapshot() {
					return status;
				}
			};
		}
		//#endregion
		//#region src/client/settings-face.ts
		/**
		* Coalesce concurrent `describe` reads onto one wire call: every provider card
		* panel and the footer area reload from the same document update, and each one
		* describing the whole document separately would multiply the round trips by
		* the number of custom providers. Only in-flight reads are shared, so a later
		* call always observes the document as it stands then; `mutate` is passed
		* through untouched.
		* @param face - the generated remote settings face.
		* @returns a face with the same contract whose concurrent describes share one read.
		*/
		function coalesceDescribe(face) {
			let inflight;
			return {
				describe() {
					if (inflight === void 0) {
						const pending = face.describe();
						inflight = pending;
						const clear = () => {
							if (inflight === pending) inflight = void 0;
						};
						pending.then(clear, clear);
					}
					return inflight;
				},
				mutate: (ns, ops, expectedRevision) => face.mutate(ns, ops, expectedRevision)
			};
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* Required services: slot registry, dictionary registry, the remote wire, and
		* the traced settings namespace — accessing `remote.settings` without
		* declaring the dotted path fails at runtime.
		*/
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.settings"
		];
		/**
		* Client plugin body: register dictionaries, wire the refresh bus, and seat
		* both Models-page extension areas for the pi-ai family.
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
			}, "dsh-model-capabilities: dictionaries");
			const settings = coalesceDescribe(ctx.get("remote").settings);
			const listeners = /* @__PURE__ */ new Set();
			const refresh = {
				subscribe(callback) {
					listeners.add(callback);
					return () => {
						listeners.delete(callback);
					};
				},
				notify() {
					for (const listener of [...listeners]) listener();
				}
			};
			ctx.effect(() => {
				try {
					return ctx.remote.$on("settings/document-updated", (ns) => {
						if (ns === "llm-pi-ai" || CAPS_ENTRY_IDS.includes(ns)) refresh.notify();
					});
				} catch {
					return () => {};
				}
			}, "dsh-model-capabilities: document events");
			const cardSeat = claimProviderCardSeat(ctx, {
				component: CapabilitiesPanel,
				inject: () => ({
					settings,
					refresh
				})
			});
			ctx.slots.inject("settings.models.footer", () => {
				try {
					const unregister = ctx.slots.register({
						name: "settings.models.footer",
						id: "ui-model-capabilities",
						inject: () => ({
							settings,
							refresh,
							cardSeat
						})
					}, DisabledProvidersFooter);
					return () => {
						unregister();
					};
				} catch (error) {
					try {
						console.error("[dsh-model-capabilities] the Models page footer slot refused the disabled-provider listing", error);
					} catch {}
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