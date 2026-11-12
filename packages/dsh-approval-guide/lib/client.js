// 注册名必须严格等于 package.json 的 name：loader 按行里解析出的包名去
// factories 里认领 factory（@deepseek-ai/dsh-client-modules 的
// "loaded without registering" 校验），对不上就在浏览器侧加载失败。
window.__ModuleLoader__.load({
	id: "@fish-under-sea/dsh-approval-guide",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react_jsx_runtime = require("react/jsx-runtime");
		//#region 样式：复用外壳的设计令牌，跟随明暗主题
		const css = ".dag_root{display:flex;flex-direction:column;gap:8px}.dag_command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);word-break:break-all;font-size:13px;line-height:20px}.dag_card{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-state-warn-tertiary);font-family:var(--dsw-font-family,inherit);word-break:normal}.dag_title{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:18px}.dag_what{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}.dag_riskTitle{color:var(--dsw-alias-state-warn-primary);font-size:12px;font-weight:600;line-height:18px;margin-top:2px}.dag_cardDanger .dag_riskTitle{color:var(--dsw-alias-state-error-primary)}.dag_risk{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}.dag_check{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin-top:2px}.dag_facts{margin:2px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:2px}.dag_fact{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dag_factLabel{color:var(--dsw-alias-label-secondary)}.dag_factValue{word-break:break-word}";
		const tagId = "dsh-approval-guide/ApprovalGuide.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-approval-guide";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const styles = {
			root: "dag_root",
			command: "dag_command",
			card: "dag_card",
			cardDanger: "dag_cardDanger",
			title: "dag_title",
			what: "dag_what",
			riskTitle: "dag_riskTitle",
			risk: "dag_risk",
			check: "dag_check",
			facts: "dag_facts",
			fact: "dag_fact",
			factLabel: "dag_factLabel",
			factValue: "dag_factValue"
		};
		//#endregion
		//#region 中文文案：按沙箱目标模式分级，一律中文显示
		/** DSH 内置沙箱模式的中文名。 */
		const MODE_LABELS = {
			"read-only": "只读（read-only）",
			"workspace-write": "工作区可写（workspace-write）",
			"danger-full-access": "完全放开（danger-full-access）"
		};
		/** 危险级别：只有完全放开才标红。 */
		const DANGER_MODE = "danger-full-access";
		/** 固定的行动建议。 */
		const CHECK = "拿不准就先点「拒绝」：拒绝不会中断对话，之后我可以换成只读、或只写工作区内的方式重试。";
		/** 找不到工具名时的占位。 */
		const UNKNOWN_TOOL = "（未知工具）";
		/** 宿主沙箱升级请求的理由句式：`escalate sandbox to <mode>: <理由>`。 */
		const SANDBOX_REASON = /^escalate sandbox to\s+([A-Za-z0-9._-]+)\s*:\s*([\s\S]*)$/;
		/**
		* 解析工具调用的原始参数。
		* @param argsRaw - 工具调用参数 JSON 文本。
		* @returns 参数对象；缺失或非对象时返回 undefined（绝不抛异常）。
		*/
		function parseCallArgs(argsRaw) {
			if (typeof argsRaw !== "string" || argsRaw === "") return void 0;
			try {
				const parsed = JSON.parse(argsRaw);
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
				return parsed;
			} catch {
				return void 0;
			}
		}
		/**
		* 从宿主给的英文理由句子里解析沙箱升级信息。
		* @param reason - 审批理由原文。
		* @returns 目标模式与理由；不匹配时返回 undefined。
		*/
		function parseSandboxReason(reason) {
			if (typeof reason !== "string") return void 0;
			const matched = SANDBOX_REASON.exec(reason);
			if (matched === null) return void 0;
			const justification = matched[2].trim();
			return {
				mode: matched[1],
				...justification === "" ? {} : { justification }
			};
		}
		/** 规整工具名。 */
		function toolLabelOf(toolName) {
			return typeof toolName === "string" && toolName.trim() !== "" ? toolName.trim() : UNKNOWN_TOOL;
		}
		/** 沙箱升级的中文说明。 */
		function sandboxGuide(toolLabel, mode, justification, known) {
			const danger = mode === DANGER_MODE;
			const shared = `只对本次调用生效：不产生长期授权，也不影响之后的命令。`;
			let what;
			let risk;
			if (danger) {
				what = `把这一次 ${toolLabel} 调用的文件沙箱范围提升到「完全放开」（${mode}）。${shared}`;
				risk = "放开后这条命令不再受工作区边界约束：它可以读写本机任意文件，包括系统目录、其它项目、SSH 密钥与凭据文件，本次执行也不再逐条征求你的同意。只有在你完全信任这条命令时才应允许。";
			} else if (mode === "workspace-write") {
				what = `把这一次 ${toolLabel} 调用的文件沙箱范围提升到「工作区可写」（${mode}）。${shared}`;
				risk = "这条命令可以写入当前工作区目录及其子目录，以及系统临时目录；工作区之外的位置仍然不能写入。请留意命令里是否出现工作区以外的写入路径。";
			} else if (known) {
				what = `把这一次 ${toolLabel} 调用的权限提升到 ${mode}。${shared}`;
				risk = "这条命令会按它请求的权限运行，范围不由工作区边界限定。请先确认命令内容确实是你想执行的操作。";
			} else {
				what = `把这一次 ${toolLabel} 调用的权限提升到 ${mode}。${shared}`;
				risk = "这不是 DSH 内置的沙箱模式，无法给出确切范围。批准后该命令会按它请求的权限运行，可能影响工作区之外的内容。请先确认命令内容可信。";
			}
			return {
				level: danger ? "danger" : "caution",
				scope: "sandbox-escalation",
				what,
				risk
			};
		}
		/** 非沙箱升级的通用中文说明。 */
		function genericGuide(toolLabel) {
			return {
				level: "caution",
				scope: "generic",
				what: `工具 ${toolLabel} 请求以更高权限执行这一次操作。批准只对本次调用生效，不会形成长期授权。`,
				risk: "批准后该工具会按它请求的更高权限运行：可能修改工作区之外的文件、执行系统级命令，或访问本机资源。请先核对上方的理由和下面的命令，确认它确实是你想执行的内容。"
			};
		}
		/**
		* 为一次审批生成中文说明（纯函数，不读全局状态，不抛异常）。
		* @param input - 工具名、审批理由、关联的工具调用参数。
		* @returns 会做什么 / 有什么风险 / 判断依据与建议。
		*/
		function explainApproval(input) {
			const source = input === undefined || input === null ? {} : input;
			const args = source.args;
			const toolLabel = toolLabelOf(source.toolName);
			const parsed = parseSandboxReason(source.reason);
			const argsMode = typeof args?.sandbox_permissions === "string" && args.sandbox_permissions !== "" ? args.sandbox_permissions : void 0;
			const mode = argsMode ?? parsed?.mode;
			const argsJustification = typeof args?.justification === "string" && args.justification.trim() !== "" ? args.justification.trim() : void 0;
			const justification = argsJustification ?? parsed?.justification;
			const command = typeof args?.command === "string" && args.command !== "" ? args.command : void 0;
			const body = mode === void 0 ? genericGuide(toolLabel) : sandboxGuide(toolLabel, mode, justification, Object.hasOwn(MODE_LABELS, mode));
			const facts = [{ label: "工具", value: toolLabel }];
			if (mode !== void 0) facts.push({ label: "目标权限", value: MODE_LABELS[mode] ?? mode });
			if (justification !== void 0) facts.push({ label: "模型给的理由", value: justification });
			return {
				...body,
				check: CHECK,
				facts,
				...command === void 0 ? {} : { command },
				toolName: source.toolName
			};
		}
		//#endregion
		//#region 组件：占用「审批详情」插槽，渲染原命令 + 中文说明
		/**
		* 在 Chat store 里找与审批关联的工具调用根节点。
		* @param snapshot - Chat store 快照。
		* @param callId - 审批关联的工具调用 id。
		* @returns 工具调用根节点；找不到时返回 undefined。
		*/
		function findCorrelatedCall(snapshot, callId) {
			if (snapshot === void 0 || snapshot === null || callId === void 0) return void 0;
			const nodes = snapshot.nodes;
			if (nodes === void 0 || nodes === null || typeof nodes.values !== "function") return void 0;
			for (const node of nodes.values()) {
				const root = node?.kind === "tool-call" ? node.data?.root : void 0;
				if (root !== void 0 && root !== null && root.callId === callId && !("kind" in root)) return root;
			}
			return void 0;
		}
		/**
		* 审批卡片内的详情区：原文命令 + 中文风险说明。
		* @param props - 插槽标准属性（callId、会话、chat 与待办交互选择器）。
		* @returns 详情区元素。
		*/
		function ApprovalGuide(props) {
			// 插槽标准属性在 DSH 0.2.0 改名：useSessionPendingInteraction → useSessionStatus，
			// 且选择器形状由「会话 Map」变为「会话状态快照」。这里同时兼容两代宿主：
			// 0.2.0 走 useSessionStatus(snapshot => snapshot.get(id)?.pendingInteraction)，
			// 0.1.x 回退 useSessionPendingInteraction(bySession => bySession.get(id))。
			const readStatus = props.useSessionStatus;
			const readPendingLegacy = props.useSessionPendingInteraction;
			const pending = typeof readStatus === "function" ? readStatus((snapshot) => snapshot === void 0 || snapshot === null ? void 0 : snapshot.get(props.sessionId)?.pendingInteraction) : typeof readPendingLegacy === "function" ? readPendingLegacy((bySession) => bySession === void 0 || bySession === null ? void 0 : bySession.get(props.sessionId)) : void 0;
			const approval = pending !== void 0 && pending !== null && pending.kind === "approval" ? pending : void 0;
			const readChat = props.useChat;
			const argsRaw = typeof readChat === "function" ? readChat((snapshot) => {
				const call = findCorrelatedCall(snapshot, props.callId);
				return call === void 0 || call === null ? void 0 : call.argsRaw;
			}) : void 0;
			const guide = explainApproval({
				toolName: approval === void 0 ? void 0 : approval.toolName,
				reason: approval === void 0 ? void 0 : approval.reason,
				args: parseCallArgs(argsRaw)
			});
			const children = [];
			if (guide.command !== void 0) children.push((0, react_jsx_runtime.jsx)("div", {
				className: styles.command,
				children: guide.command
			}, "command"));
			const card = [
				(0, react_jsx_runtime.jsx)("div", {
					className: styles.title,
					children: "这次审批会做什么"
				}, "whatTitle"),
				(0, react_jsx_runtime.jsx)("div", {
					className: styles.what,
					children: guide.what
				}, "what"),
				(0, react_jsx_runtime.jsx)("div", {
					className: styles.riskTitle,
					children: "风险"
				}, "riskTitle"),
				(0, react_jsx_runtime.jsx)("div", {
					className: styles.risk,
					children: guide.risk
				}, "risk")
			];
			if (guide.facts.length > 0) card.push((0, react_jsx_runtime.jsx)("ul", {
				className: styles.facts,
				children: guide.facts.map((fact, index) => (0, react_jsx_runtime.jsx)("li", {
					className: styles.fact,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: styles.factLabel,
						children: `${fact.label}：`
					}, "label"), (0, react_jsx_runtime.jsx)("span", {
						className: styles.factValue,
						children: fact.value
					}, "value")]
				}, `fact-${String(index)}`))
			}, "facts"));
			card.push((0, react_jsx_runtime.jsx)("div", {
				className: styles.check,
				children: guide.check
			}, "check"));
			children.push((0, react_jsx_runtime.jsx)("div", {
				className: guide.level === "danger" ? `${styles.card} ${styles.cardDanger}` : styles.card,
				children: card
			}, "guide"));
			return (0, react_jsx_runtime.jsx)("div", {
				className: styles.root,
				"data-approval-guide": guide.scope,
				children
			});
		}
		//#endregion
		//#region 空输入发送增强：输入框为空时点发送不再发死键
		/** 输入框为空时点发送按钮要自动填入并发送的固定文案。 */
		const EMPTY_SEND_TEXT = "继续任务，并梳理进度";
		/** 等 React 重渲染把按钮从 disabled 变为可用的有界轮询：24ms × 34 ≈ 816ms。 */
		const SEND_POLL_INTERVAL = 24;
		const SEND_POLL_ATTEMPTS = 34;
		/** 提交后吞掉同一次手势可能补发的原生 click 的窗口（毫秒）。 */
		const CLICK_GUARD_MS = 600;
		const WARN_WRITE = "dsh-approval-guide: 空输入自动发送写入文本失败，已保留原行为。";
		const WARN_TIMEOUT = "dsh-approval-guide: 空输入自动发送等待发送按钮可用超时，本次未发送。";
		/** 附件/上传态的 DOM 线索：显式标记优先，aria-busy 兜住官方缩略图的上传态。 */
		const ATTACHMENT_SELECTOR = "[data-attachment],[data-composer-attachment],[data-uploading],[aria-busy=\"true\"]";
		/** 元素判断不依赖 instanceof：插件与宿主可能分属不同 realm。 */
		function isElement(node) {
			return node !== null && typeof node === "object" && node.nodeType === 1;
		}
		/** 读属性；没有 hasAttribute 的假 DOM 也不抛。 */
		function hasAttr(el, name) {
			if (typeof el?.hasAttribute === "function") return el.hasAttribute(name);
			return el?.getAttribute?.(name) !== null && el?.getAttribute?.(name) !== void 0;
		}
		/** 主按钮：DSH 的发送/停止按钮类名是 CSS Modules 哈希前缀 + `_primary`。 */
		function isPrimaryButton(node) {
			if (!isElement(node) || String(node.tagName ?? "").toUpperCase() !== "BUTTON") return false;
			return String(node.getAttribute?.("class") ?? "").split(/\s+/).some((token) => token.endsWith("_primary"));
		}
		/**
		* 发送按钮：主按钮、不是「正在发送」、也不是停止按钮。
		* 停止按钮的图标是 svg > rect（方块），发送按钮是 svg > path（箭头）；
		* 不能只看 `_primary` 类名 —— 停止按钮用的是同一个类。
		*/
		function isSendButton(node) {
			if (!isPrimaryButton(node)) return false;
			if (hasAttr(node, "data-sending")) return false;
			if (node.getAttribute?.("aria-busy") === "true") return false;
			const stopGlyph = typeof node.querySelector === "function" && node.querySelector("svg rect") !== null;
			return !stopGlyph;
		}
		/**
		* 从事件目标（或坐标命中）找到发送按钮。
		* 空输入时按钮是 disabled，部分浏览器会把 pointerdown 重定向到父节点，
		* 所以再用 elementFromPoint 按坐标兜底一次。
		*/
		function sendButtonOf(event, doc) {
			const target = isElement(event?.target) ? event.target : null;
			const direct = target?.closest?.("button");
			if (isSendButton(direct)) return direct;
			if (typeof doc?.elementFromPoint !== "function") return null;
			const point = doc.elementFromPoint(event?.clientX ?? 0, event?.clientY ?? 0);
			const hit = isElement(point) ? point.closest?.("button") : null;
			return isSendButton(hit) ? hit : null;
		}
		/** 发送按钮所在的编辑器卡片。 */
		function composerCardOf(button) {
			return typeof button?.closest === "function" ? button.closest("[data-composer-card]") : null;
		}
		/** 卡片里的 Lexical 编辑器根；同页可能有多份输入框，所以先按卡片缩小范围。 */
		function editorOf(card, doc) {
			const scope = card ?? doc;
			if (typeof scope?.querySelector !== "function") return null;
			return scope.querySelector('[data-lexical-editor="true"][role="textbox"]') ?? scope.querySelector("[data-composer-input]") ?? null;
		}
		/** 编辑器里的文本。 */
		function editorText(editor) {
			return String(editor?.textContent ?? "");
		}
		/** 编辑器此刻可写、且不处于 slash 命令认领 / 提交中等阶段。 */
		function editorReady(editor) {
			if (editor === null) return false;
			const editable = editor.getAttribute?.("contenteditable");
			if (editable !== null && editable !== void 0 && String(editable).toLowerCase() === "false") return false;
			if (editor.getAttribute?.("aria-disabled") === "true") return false;
			const phase = editor.getAttribute?.("data-phase");
			return phase === null || phase === void 0 || phase === "plain";
		}
		/** 装饰节点 / 已认领的 slash 命令：不接管（发送会把它们丢掉）。 */
		function hasEditorDecoration(editor) {
			if (typeof editor?.querySelector !== "function") return false;
			return editor.querySelector('[data-composer-command],[data-lexical-decorator="true"],[data-composer-chip]') !== null;
		}
		/** 已暂存附件或正在上传：不接管（用户可能想连附件一起发）。 */
		function hasAttachments(card, editor) {
			if (card === null) return false;
			if (typeof card.querySelector === "function" && card.querySelector(ATTACHMENT_SELECTOR) !== null) return true;
			// 附件轨道由 ComposerAttachments 直接渲染成卡片的子元素（编辑器之前），
			// 里面固定有一个 role="group" 列表；overlay 锚点是命令菜单，不算附件。
			const editorHost = typeof editor?.closest === "function" ? editor.closest("[data-input-scroll]") : null;
			for (const child of Array.from(card.children ?? [])) {
				if (editorHost !== null && (child === editorHost || child.contains?.(editorHost) === true)) break;
				if (!isElement(child) || hasAttr(child, "data-composer-overlay")) continue;
				if (child.querySelector?.('[role="group"]') !== null) return true;
			}
			return false;
		}
		/** 加号按钮的 aria-expanded 为 true 时命令菜单开着，让位给宿主。 */
		function commandMenuOpen(card) {
			return typeof card?.querySelector === "function" && card.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]') !== null;
		}
		/** 聚焦输入框：execCommand("insertText") 需要焦点在编辑器里。 */
		function focusEditor(editor) {
			try {
				editor.focus?.({ preventScroll: true });
			} catch {
				try {
					editor.focus?.();
				} catch {
					/* 聚焦失败不影响后面的兜底写入 */
				}
			}
		}
		/**
		* 把文本写进 Lexical 编辑器，三级兜底（每一级都不抛异常）：
		*   1) document.execCommand("insertText")：原生编辑命令，Lexical 会收到
		*      beforeinput/input，DOM 与内部状态一起更新 —— 首选。
		*   2) 合成 paste 事件（带 text/plain）：Lexical 的粘贴处理插入纯文本。
		*   3) 直接写 DOM 再发 input 事件：最后的兜底，至少让用户可以接着手动发送。
		* @returns 编辑器里是否真的出现了文本。
		*/
		function writeTextToEditor(editor, text, doc, win) {
			try {
				if (typeof doc?.execCommand === "function" && doc.execCommand("insertText", false, text) === true && editorText(editor).trim() !== "") return true;
			} catch {
				/* 下一级兜底 */
			}
			try {
				let data;
				if (typeof win?.DataTransfer === "function") {
					data = new win.DataTransfer();
					data?.setData?.("text/plain", text);
				}
				let paste;
				try {
					paste = new win.ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data });
				} catch {
					paste = new win.Event("paste", { bubbles: true, cancelable: true });
				}
				if (data !== void 0 && paste.clipboardData !== data) {
					try {
						Object.defineProperty(paste, "clipboardData", { value: data });
					} catch {
						/* 只读就按纯事件走 */
					}
				}
				editor.dispatchEvent(paste);
				if (editorText(editor).trim() !== "") return true;
			} catch {
				/* 下一级兜底 */
			}
			try {
				editor.textContent = text;
				let input;
				try {
					input = new win.InputEvent("input", { bubbles: true, inputType: "insertText", data: text });
				} catch {
					input = new win.Event("input", { bubbles: true });
				}
				editor.dispatchEvent(input);
			} catch {
				return false;
			}
			return editorText(editor).trim() !== "";
		}
		/**
		* 安装「空输入点发送」增强：命中空输入状态下的发送按钮时，自动填入固定文案并只提交一次。
		*
		* 为什么用 pointerdown 而不是 click：空输入时发送按钮是 disabled，click 根本不会派发；
		* 有些浏览器还会把 pointerdown 重定向到父节点，所以再用 elementFromPoint 按坐标兜底。
		* 一旦接管：preventDefault + stopPropagation，聚焦编辑器、写入文案，再等按钮变可用后
		* 程序化点击一次。全程有重入保护与有界超时，失败只 warn 一次、不重试轰炸。
		*
		* @returns 卸载函数（移除监听、清掉轮询与一次性 click 守卫）。
		*/
		function installEmptySend() {
			const doc = typeof document === "undefined" ? void 0 : document;
			const win = typeof window === "undefined" ? void 0 : window;
			if (doc === void 0 || win === void 0 || typeof doc.addEventListener !== "function" || typeof doc.querySelector !== "function" || typeof win.setTimeout !== "function" || typeof win.clearTimeout !== "function") return () => {};
			let disposed = false;
			let inFlight = false;
			let timer = 0;
			/** 手势期间以及提交后短暂窗口内吞掉发送按钮的 click，避免同一次手势提交两次。 */
			let clickGuard = null;
			let guardTimer = 0;
			const warn = (message) => {
				try {
					win.console?.warn?.(message);
				} catch {
					/* 记日志本身不该影响输入框 */
				}
			};
			const swallow = (event) => {
				try {
					event.preventDefault?.();
				} catch {
					/* 忽略 */
				}
				try {
					event.stopPropagation?.();
				} catch {
					/* 忽略 */
				}
			};
			const removeClickGuard = () => {
				if (guardTimer !== 0) {
					try {
						win.clearTimeout(guardTimer);
					} catch {
						/* 忽略 */
					}
					guardTimer = 0;
				}
				if (clickGuard === null) return;
				try {
					doc.removeEventListener("click", clickGuard, true);
				} catch {
					/* 忽略 */
				}
				clickGuard = null;
			};
			/**
			* 挂上 click 守卫：只吞发送按钮上的 click，吞到一次就摘掉。
			* @param graceMs - 大于 0 时到点自动摘掉（提交后的短暂窗口）；0 表示交给 release 摘。
			*/
			const armClickGuard = (graceMs) => {
				if (clickGuard !== null) return;
				const guard = (clickEvent) => {
					if (sendButtonOf(clickEvent, doc) === null) return;
					swallow(clickEvent);
					removeClickGuard();
				};
				clickGuard = guard;
				try {
					doc.addEventListener("click", guard, true);
				} catch {
					clickGuard = null;
					return;
				}
				if (graceMs > 0) {
					guardTimer = win.setTimeout(() => {
						guardTimer = 0;
						removeClickGuard();
					}, graceMs);
				}
			};
			const release = () => {
				inFlight = false;
				if (timer !== 0) {
					try {
						win.clearTimeout(timer);
					} catch {
						/* 忽略 */
					}
					timer = 0;
				}
				removeClickGuard();
			};
			const submit = (button) => {
				if (disposed || !inFlight) {
					release();
					return;
				}
				// 先摘守卫，否则会把这次程序化点击也吞掉。
				removeClickGuard();
				if (timer !== 0) {
					try {
						win.clearTimeout(timer);
					} catch {
						/* 忽略 */
					}
					timer = 0;
				}
				try {
					button.click();
				} catch {
					warn(WARN_TIMEOUT);
				}
				// 提交后进入短暂冷却：同一手势可能补发一个原生 click（按钮刚变可用），
				// 用户也可能双击；这段时间内既吞 click 也继续吞 pointerdown，
				// 否则「继续任务」会被发两次。冷却结束由 release 统一收尾。
				armClickGuard(CLICK_GUARD_MS);
				timer = win.setTimeout(() => {
					timer = 0;
					release();
				}, CLICK_GUARD_MS);
			};
			const poll = (button, attempt) => {
				if (disposed || !inFlight) return;
				if (button.isConnected === false) {
					warn(WARN_TIMEOUT);
					release();
					return;
				}
				if (button.disabled !== true) {
					submit(button);
					return;
				}
				if (attempt >= SEND_POLL_ATTEMPTS) {
					warn(WARN_TIMEOUT);
					release();
					return;
				}
				timer = win.setTimeout(() => {
					timer = 0;
					poll(button, attempt + 1);
				}, SEND_POLL_INTERVAL);
			};
			const takeOver = (event) => {
				if (disposed) return;
				if (event?.button !== void 0 && event.button !== 0) return;
				const button = sendButtonOf(event, doc);
				if (button === null) return;
				// 重入保护：从接管到提交完成期间，重复 pointerdown 一律吞掉，绝不重复发送。
				if (inFlight) {
					swallow(event);
					return;
				}
				const card = composerCardOf(button);
				const editor = editorOf(card, doc);
				if (editor === null) return;
				if (event?.isComposing === true || hasAttr(editor, "data-composer-composing")) return;
				if (!editorReady(editor) || hasEditorDecoration(editor)) return;
				if (commandMenuOpen(card) || hasAttachments(card, editor)) return;
				if (editorText(editor).trim() !== "") return;
				if (button.disabled !== true) return;
				swallow(event);
				inFlight = true;
				// 吞掉这次手势随后产生的原生 click：文案写入后按钮会被 React 变可用，
				// 用户松手仍可能生成一次 click；不拦就会和程序化点击一起提交两次。
				armClickGuard(0);
				let written = false;
				try {
					focusEditor(editor);
					written = writeTextToEditor(editor, EMPTY_SEND_TEXT, doc, win);
				} catch {
					written = false;
				}
				if (!written) {
					warn(WARN_WRITE);
					release();
					return;
				}
				poll(button, 0);
			};
			doc.addEventListener("pointerdown", takeOver, true);
			return () => {
				disposed = true;
				release();
				try {
					doc.removeEventListener("pointerdown", takeOver, true);
				} catch {
					/* 忽略 */
				}
			};
		}
		//#endregion
		//#region 插件挂载
		/** 必需服务：插槽注册表。 */
		const inject = ["slots"];
		/**
		* 把中文说明挂到审批详情插槽。
		*
		* `conversation.approval.detail` 是 single 插槽，官方占用者是
		* `@deepseek-ai/dsh-client-ui-chat` 的 ApprovalCommand（默认优先级 0）；
		* single 插槽同级注册会直接报错，且优先级数字最小者渲染，因此这里用 -1
		* 覆盖它，并在组件里自己把原始命令重新渲染回来。组件崩溃时条目会被
		* 回收（abdicate），自动退回官方实现，不会留下空白审批卡。
		*
		* @param ctx - 客户端根上下文。
		*/
		function apply(ctx) {
			ctx.slots.inject("conversation.approval.detail", () => ctx.slots.register({
				name: "conversation.approval.detail",
				priority: -1
			}, ApprovalGuide));
			if (typeof ctx.effect === "function") ctx.effect(() => installEmptySend(), "dsh-approval-guide: 空输入自动发送");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.__internals = {
			ApprovalGuide,
			explainApproval,
			parseCallArgs,
			parseSandboxReason,
			findCorrelatedCall,
			installEmptySend,
			writeTextToEditor,
			EMPTY_SEND_TEXT
		};
		return module.exports;
	}
});