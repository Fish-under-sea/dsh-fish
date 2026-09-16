window.__ModuleLoader__.load({
	id: "dsh-approval-guide",
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
			const readPending = props.useSessionPendingInteraction;
			const pending = typeof readPending === "function" ? readPending((bySession) => bySession === void 0 || bySession === null ? void 0 : bySession.get(props.sessionId)) : void 0;
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
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.__internals = {
			ApprovalGuide,
			explainApproval,
			parseCallArgs,
			parseSandboxReason,
			findCorrelatedCall
		};
		return module.exports;
	}
});