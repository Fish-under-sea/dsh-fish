/**
 * dsh-settings-nav-order —— 浏览器半边。
 *
 * 做两件事，都是「只改样式、不碰别人的代码」：
 *
 *   1. 排序 —— 按用户保存的顺序，给「设置」面板左侧那列导航按钮打 CSS `order`。
 *      容器是 flex column，所以视觉顺序跟着 `order` 变，而 DOM 顺序、各插件的代码、
 *      React 的 key 全都不用碰。这就是这个插件存在的理由：菜单顺序原本写死在每个
 *      插件的 `settings.section` 注册里，谁也没法改。
 *   2. 隐藏 —— 给不想要的项打 `display:none`，把入口收起来（插件本身照常工作）。
 *      节点仍然留在 DOM 里，取消隐藏立刻回来，所以「隐藏」是可逆的显示偏好，
 *      不是卸载。
 *
 * 为什么用 localStorage 而不是宿主配置文件：这是「这台机器上这个浏览器」的显示
 * 偏好，跨设备同步没有意义；也因此宿主半边是空实现，不需要 API、不需要读盘。
 * 键：dsh-settings-nav-order/v1（加 hidden 字段时沿用同一个键，老数据照读）。
 *
 * 识别方式：导航按钮没有 id 也没有 data 属性（见 dsh-client-ui-settings-general
 * 的 SettingsRoot 渲染），类名还是 CSS Modules 的哈希名，只能按「类名里含原名」
 * 找容器、读标签文本认项。同名项（理论上可能存在）用「同名第几个」区分，所以配置
 * 里存的是 { name, index } 而不是裸名字。
 *
 * 失败姿势：任何一步出错都退回「原样显示」——面板读不到、样式打不上、配置坏掉，
 * 结果都只是顺序/隐藏没生效，不会白屏、不会少项。
 */
window.__ModuleLoader__.load({
	id: '@fish-under-sea/dsh-settings-nav-order',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
		const react = require('react');
		const h = react.createElement;

		/** localStorage 键：带版本号，将来结构变了可以另起键，老数据自然失效。 */
		const STORE_KEY = 'dsh-settings-nav-order/v1';

		/** 本页自己的菜单名。它同时是「唯一能取消隐藏的入口」，所以永远不许被隐藏。 */
		const PANEL_LABEL = '设置导航顺序';

		/** 出厂状态：启用、没有自定义顺序、没有隐藏项（即保持各插件自己的样子）。 */
		const DEFAULT_CONFIG = { enabled: true, order: [], hidden: [] };

		/** 出厂状态的新副本：数组不能共用，免得谁改了配置把常量带脏。 */
		function defaultConfig() {
			return { enabled: true, order: [], hidden: [] };
		}

		/** 把配置里的一段 { name, index } 列表洗干净；坏形状一律丢成空数组。 */
		function normalizeRows(value) {
			if (!Array.isArray(value)) return [];
			return value
				.filter((row) => row !== null && typeof row === 'object' && typeof row.name === 'string')
				.map((row) => ({ name: row.name, index: Number.isInteger(row.index) ? row.index : 0 }));
		}

		/**
		 * 读取保存的配置；任何异常（没配过、坏 JSON、字段类型不对、隐私模式）都退回
		 * 出厂状态。老配置没有 hidden 字段，读出来就是空数组——已保存的顺序不丢。
		 */
		function loadConfig() {
			try {
				const raw = window.localStorage.getItem(STORE_KEY);
				if (!raw) return defaultConfig();
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== 'object') return defaultConfig();
				return {
					enabled: parsed.enabled !== false,
					order: normalizeRows(parsed.order),
					hidden: normalizeRows(parsed.hidden),
				};
			} catch {
				return defaultConfig();
			}
		}

		/** 写回配置；写不进去（配额/隐私模式）也不算错，只是这次改动不生效。 */
		function saveConfig(config) {
			try {
				window.localStorage.setItem(STORE_KEY, JSON.stringify(config));
			} catch {
				/* 忽略：显示偏好丢了不影响正确性 */
			}
		}

		/** 把菜单项按名字分组，得到「同名第几个」——同名项的唯一区分手段。 */
		function groupIndexes(items) {
			const seen = new Map();
			return items.map((item) => {
				const nth = seen.get(item.name) ?? 0;
				seen.set(item.name, nth + 1);
				return nth;
			});
		}

		/**
		 * 导航容器与标签的选择器。
		 * 真实 DOM 里的类名是 CSS Modules 的哈希名（ZiQlkq_navList / ZiQlkq_navLabel，
		 * 见 dsh-client-ui-settings-general 的 SettingsRoot 渲染），精确的 `.navList`
		 * 匹配不到，所以按「类名里含原名」匹配——DSH 换哈希前缀也不影响。
		 */
		const NAV_LIST_SELECTOR = '[class*="navList"]';
		const NAV_LABEL_SELECTOR = '[class*="navLabel"]';

		/**
		 * 取导航容器；设置面板没开时返回 null（这是最便宜的一条退出路径）。
		 * 额外要求容器里真的有 `.navLabel` 子项：类名是子串匹配，万一别处撞了
		 * 同名字串，这里就能挡住它，不会把 order 打到无关元素上。
		 */
		function navListOf(document) {
			if (!document || typeof document.querySelector !== 'function') return null;
			const list = document.querySelector(NAV_LIST_SELECTOR);
			if (!list || typeof list.querySelector !== 'function') return null;
			return list.querySelector(NAV_LABEL_SELECTOR) ? list : null;
		}

		/** 读取真实 DOM 里的当前菜单项（按 DOM 顺序）。面板没开时返回空数组。 */
		function collectItems(document) {
			const list = navListOf(document);
			if (!list) return [];
			const cells = Array.from(list.children ?? []).filter((cell) => cell && cell.querySelector);
			return cells.map((cell) => {
				const label = cell.querySelector(NAV_LABEL_SELECTOR);
				return { name: String((label && label.textContent) || '').trim() };
			});
		}

		/**
		 * 按 { name, index } 把配置行还原成入参里的下标：同名项用「同名第几个」定位。
		 * 当前菜单里已经不存在的项、以及已经被前面几行认领过的项，都直接跳过——
		 * 所以插件被卸载后留下的陈旧配置不会把别的项挤错位。
		 */
		function matchIndexes(items, rows) {
			const nth = groupIndexes(items);
			const used = new Set();
			const out = [];
			for (const row of Array.isArray(rows) ? rows : []) {
				if (!row || typeof row.name !== 'string') continue;
				const wanted = Number.isInteger(row.index) ? row.index : 0;
				for (let i = 0; i < items.length; i += 1) {
					if (used.has(i) || items[i].name !== row.name || nth[i] !== wanted) continue;
					used.add(i);
					out.push(i);
					break;
				}
			}
			return out;
		}

		/**
		 * 计算每项的显示名次：配置里提到的项按配置顺序拿 0..n-1，
		 * 其余项保持原有相对顺序排在后面。
		 * 返回的数组已按 rank 升序排好（第 1 个就是该显示在第 1 位的菜单项），
		 * 每行都带着它在 DOM 里的原下标 index，调用方靠它把 order 打回原按钮。
		 * @returns 与入参等长的 { name, index, rank } 数组，按 rank 升序排列。
		 */
		function computeOrder(items, saved) {
			const matched = matchIndexes(items, saved && saved.order);
			const ranks = new Array(items.length).fill(null);
			matched.forEach((index, rank) => {
				ranks[index] = rank;
			});
			let tail = matched.length;
			return items
				.map((item, i) => {
					const rank = ranks[i] === null ? tail++ : ranks[i];
					return { name: item.name, index: i, rank };
				})
				.sort((a, b) => a.rank - b.rank);
		}

		/**
		 * 配置里被隐藏的项在当前菜单里的下标。
		 * 本页自己永不出现在结果里：它是唯一能取消隐藏的入口，藏了就再也进不来了。
		 */
		function hiddenIndexes(items, saved) {
			return matchIndexes(items, saved && saved.hidden).filter((index) => items[index].name !== PANEL_LABEL);
		}

		/**
		 * 把 from 处的项取出来，插到「取出之后的列表」的第 to 位（to 会被夹到合法范围）。
		 * 拖拽与箭头共用这一条路径，两种操作的结果因此必然一致。
		 * 返回新数组，不改动入参。
		 */
		function moveTo(list, from, to) {
			if (!Array.isArray(list) || from < 0 || from >= list.length) return list.slice();
			const next = list.slice();
			const [row] = next.splice(from, 1);
			const target = Math.max(0, Math.min(Number.isInteger(to) ? to : 0, next.length));
			next.splice(target, 0, row);
			return next;
		}

		/**
		 * 移动一项：只交换相邻项（上移/下移），越界原样返回。
		 * 返回新数组，不改动入参。
		 */
		function moveItem(list, index, delta) {
			const target = index + delta;
			if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list.slice();
			return moveTo(list, index, target);
		}

		/**
		 * 按每行的垂直中线算落点：返回「插到第几行之前」，等于行数表示插到最后。
		 * @param centers - 各行的垂直中线（getBoundingClientRect 的中点）
		 * @param y - 指针的 Y
		 */
		function dropIndex(centers, y) {
			const list = Array.isArray(centers) ? centers : [];
			for (let i = 0; i < list.length; i += 1) {
				if (y < list[i]) return i;
			}
			return list.length;
		}

		/** 落点是在「含被拖项」的坐标系里算的：往后拖时要减掉被拖项自己占的那一位。 */
		function adjustDrop(from, to) {
			return to > from ? to - 1 : to;
		}

		/** 清掉上一个面板残留的 order / display / 标记。 */
		function clearNav(list) {
			for (const cell of Array.from((list && list.children) || [])) {
				if (!cell) continue;
				if (cell.style) {
					cell.style.order = '';
					cell.style.display = '';
				}
				if (typeof cell.removeAttribute === 'function') {
					cell.removeAttribute('data-nav-rank');
					cell.removeAttribute('data-nav-hidden');
				}
			}
		}

		/**
		 * 把保存的顺序与隐藏状态打到导航按钮上。任何异常都退化成「原样」。
		 * 先查容器、再读配置：MutationObserver 会因为聊天区的流式渲染而高频触发，
		 * 面板没开时必须走最便宜的退出路径，连 localStorage 都不碰。
		 */
		function applyToNav(document) {
			const list = navListOf(document);
			if (!list) return;
			const saved = loadConfig();
			if (!saved.enabled) {
				clearNav(list);
				return;
			}
			const items = collectItems(document);
			if (items.length === 0) return;
			// 必须与 collectItems 用同一套过滤：row.index 是那份列表里的下标。
			const cells = Array.from(list.children ?? []).filter((cell) => cell && cell.querySelector);

			for (const row of computeOrder(items, saved)) {
				const cell = cells[row.index];
				if (!cell) continue;
				if (cell.style) cell.style.order = String(row.rank);
				if (typeof cell.setAttribute === 'function') cell.setAttribute('data-nav-rank', String(row.rank));
			}

			const hidden = new Set(hiddenIndexes(items, saved));
			for (let i = 0; i < cells.length; i += 1) {
				const cell = cells[i];
				if (!cell || !cell.style) continue;
				if (hidden.has(i)) {
					cell.style.display = 'none';
					if (typeof cell.setAttribute === 'function') cell.setAttribute('data-nav-hidden', '1');
				} else {
					cell.style.display = '';
					if (typeof cell.removeAttribute === 'function') cell.removeAttribute('data-nav-hidden');
				}
			}
		}

		/** 面板自带的样式：只加样式，不动导航的布局。 */
		const STYLE_ID = 'dsh-settings-nav-order-style';
		const styles = `
.sno-page{display:flex;flex-direction:column;gap:12px;max-width:760px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.sno-page h3{margin:0;font-size:18px;font-weight:600}
.sno-note{padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary)}
.sno-note.warn{border-color:#c9a227;color:var(--dsw-alias-label-primary)}
.sno-list{display:flex;flex-direction:column;gap:4px}
.sno-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-3)}
.sno-row.is-dragging{opacity:.45}
.sno-row.is-drop-before{box-shadow:0 -2px 0 0 var(--dsw-alias-brand-primary)}
.sno-row.is-hidden .sno-name{text-decoration:line-through;color:var(--dsw-alias-label-tertiary)}
.sno-grip{flex:none;width:16px;color:var(--dsw-alias-label-tertiary);cursor:grab;touch-action:none;user-select:none;text-align:center;letter-spacing:-2px}
.sno-grip:active{cursor:grabbing}
.sno-pos{width:20px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,Consolas,monospace;font-size:12px}
.sno-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sno-btn{padding:3px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font-size:12px}
.sno-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
.sno-btn:disabled{opacity:.4;cursor:default}
.sno-btn.primary{border-color:var(--dsw-alias-brand-primary);font-weight:600}
.sno-hide{padding:3px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px}
.sno-hide:hover{border-color:var(--dsw-alias-brand-primary)}
.sno-row-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sno-chk{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary)}
`;

		/** 注入一次样式（重复调用无副作用）。 */
		function ensureStyles(document) {
			if (!document || document.getElementById?.(STYLE_ID)) return;
			const tag = document.createElement('style');
			tag.id = STYLE_ID;
			tag.textContent = styles;
			(document.head ?? document.body)?.appendChild(tag);
		}

		/** 配置里的顺序与隐藏状态，与当前菜单项合并成一份可编辑列表（按显示顺序）。 */
		function editableList(items, saved) {
			const hidden = new Set(hiddenIndexes(items, saved));
			return computeOrder(items, saved).map((row) => ({
				name: row.name,
				index: row.index,
				hidden: hidden.has(row.index),
			}));
		}

		/** 保存时用「同名第几个」重算序号：菜单改了也不会串位。 */
		function toSavedRows(rows) {
			const seen = new Map();
			return rows.map((row) => {
				const nth = seen.get(row.name) ?? 0;
				seen.set(row.name, nth + 1);
				return { name: row.name, index: nth };
			});
		}

		/**
		 * 一行：拖拽把手 + 序号 + 名称 + 上移/下移 + 隐藏开关。
		 * 箭头是拖拽的备用手段（键盘、触摸板），所以留着小图标而不是去掉。
		 */
		function Row(props) {
			const className = [
				'sno-row',
				props.hidden ? 'is-hidden' : '',
				props.dragging ? 'is-dragging' : '',
				props.dropBefore ? 'is-drop-before' : '',
			]
				.filter(Boolean)
				.join(' ');

			const children = [
				h(
					'span',
					{
						key: 'grip',
						className: 'sno-grip',
						title: '按住拖动排序',
						onPointerDown: props.onDragStart,
						onPointerMove: props.onDragMove,
						onPointerUp: props.onDragEnd,
						onPointerCancel: props.onDragEnd,
					},
					'⋮⋮',
				),
				h('span', { key: 'pos', className: 'sno-pos' }, props.position),
				h('span', { key: 'name', className: 'sno-name' }, props.name),
				h(
					'button',
					{
						key: 'up',
						type: 'button',
						className: 'sno-up',
						title: '上移一位',
						'aria-label': '上移',
						disabled: !props.canUp,
						onClick: props.onUp,
					},
					'↑',
				),
				h(
					'button',
					{
						key: 'down',
						type: 'button',
						className: 'sno-down',
						title: '下移一位',
						'aria-label': '下移',
						disabled: !props.canDown,
						onClick: props.onDown,
					},
					'↓',
				),
			];

			// 本页自己不给隐藏按钮：它是唯一能取消隐藏的入口。
			if (props.canHide) {
				children.push(
					h(
						'button',
						{
							key: 'hide',
							type: 'button',
							className: 'sno-hide',
							title: props.hidden ? '重新显示这一项' : '把这一项从左侧菜单收起来',
							onClick: props.onToggleHide,
						},
						props.hidden ? '显示' : '隐藏',
					),
				);
			}

			return h(
				'div',
				{
					className,
					// move/up 也挂在行上：指针拖出把手之后（捕获失败或跨行拖动）仍然收得到。
					onPointerMove: props.onDragMove,
					onPointerUp: props.onDragEnd,
					onPointerCancel: props.onDragEnd,
				},
				children,
			);
		}

		/**
		 * 设置页：列出当前菜单顺序，允许拖动/箭头调序、隐藏与恢复、保存、恢复默认、整体停用。
		 * @param props - 槽位注入的属性（本页不使用）。
		 */
		function SettingsNavPanel() {
			const [config, setConfig] = react.useState(() => loadConfig());
			const [items, setItems] = react.useState(() => collectItems(typeof document === 'undefined' ? undefined : document));
			const [draft, setDraft] = react.useState(() => editableList(items, config));
			const [dirty, setDirty] = react.useState(false);
			const [dragFrom, setDragFrom] = react.useState(-1);
			const [dropAt, setDropAt] = react.useState(-1);

			react.useEffect(() => {
				ensureStyles(document);
				const live = collectItems(document);
				if (live.length > 0) {
					setItems(live);
					setDraft(editableList(live, loadConfig()));
				}
			}, []);

			/** 一次改动：换草稿 + 标记未保存。 */
			const change = (next) => {
				setDraft(next);
				setDirty(true);
			};

			/** 从草稿拼出完整配置：顺序与隐藏都来自同一个列表，永远互相对得上。 */
			const configFrom = (rows, base) => ({
				...base,
				order: toSavedRows(rows),
				hidden: toSavedRows(rows.filter((row) => row.hidden)),
			});

			const commit = (next) => {
				setConfig(next);
				saveConfig(next);
				applyToNav(document);
				setDirty(false);
			};

			const move = (from, to) => change(moveTo(draft, from, to));

			const toggleHide = (index) => {
				change(draft.map((row, i) => (i === index ? { ...row, hidden: !row.hidden } : row)));
			};

			/** 拖拽开始：把指针捕获到把手上，这样移出把手也收得到 move/up。 */
			const dragStart = (index, event) => {
				const handle = event && event.currentTarget;
				if (handle && typeof handle.setPointerCapture === 'function' && event.pointerId !== undefined) {
					try {
						handle.setPointerCapture(event.pointerId);
					} catch {
						/* 忽略：捕获失败也能靠把手上的事件走完 */
					}
				}
				setDragFrom(index);
				setDropAt(index);
			};

			/** 拖拽中：用各行中线算落点，再把「含被拖项」的坐标换算成取出后的下标。 */
			const dragMove = (event) => {
				if (dragFrom < 0 || !event) return;
				const handle = event.currentTarget;
				const list =
					(handle && typeof handle.closest === 'function' && handle.closest('.sno-list')) ||
					(handle && handle.parentElement && handle.parentElement.parentElement) ||
					null;
				const centers = Array.from((list && list.children) || []).map((cell) => {
					if (!cell || typeof cell.getBoundingClientRect !== 'function') return 0;
					const rect = cell.getBoundingClientRect();
					// 被隐藏的行 rect 全是 0，会让落点算歪：给一个永远不会被选中的值。
					if (rect.height === 0) return Number.NEGATIVE_INFINITY;
					return rect.top + rect.height / 2;
				});
				setDropAt(adjustDrop(dragFrom, dropIndex(centers, event.clientY ?? 0)));
			};

			/** 拖拽结束：落点与起点不同就落位，否则什么也不做。 */
			const dragEnd = () => {
				if (dragFrom < 0) return;
				if (dropAt >= 0 && dropAt !== dragFrom) change(moveTo(draft, dragFrom, dropAt));
				setDragFrom(-1);
				setDropAt(-1);
			};

			return h(
				'div',
				{ className: 'sno-page' },
				h('h3', null, PANEL_LABEL),
				h(
					'div',
					{ className: 'sno-note' },
					'按住每行左边的 ⋮⋮ 拖动就能排序（也可以点 ↑ / ↓）；不想看到某一项，点「隐藏」把它从左侧菜单收起来——插件本身照常工作，随时点「显示」找回来。保存后立即生效；这些偏好只存在这个浏览器里（localStorage），不动任何插件的代码，插件更新也不会丢。',
				),
				h(
					'label',
					{ className: 'sno-chk' },
					h('input', {
						type: 'checkbox',
						className: 'sno-toggle',
						checked: config.enabled,
						onChange: (event) => commit({ ...config, enabled: Boolean(event.target.checked) }),
					}),
					'启用手动排序与隐藏（关掉＝完全用各插件自己的样子）',
				),
				dirty
					? h('div', { className: 'sno-note warn' }, '未保存：下面的顺序/隐藏还没写进配置。')
					: h('div', { className: 'sno-note' }, '当前顺序与已保存的一致。'),
				h(
					'div',
					{ className: 'sno-list' },
					draft.map((row, i) =>
						h(Row, {
							key: `${row.name}#${row.index}#${i}`,
							position: i + 1,
							name: row.name,
							hidden: row.hidden,
							canUp: i > 0,
							canDown: i < draft.length - 1,
							canHide: row.name !== PANEL_LABEL,
							dragging: dragFrom === i,
							dropBefore: dragFrom >= 0 && dropAt === i,
							onUp: () => move(i, i - 1),
							onDown: () => move(i, i + 1),
							onToggleHide: () => toggleHide(i),
							onDragStart: (event) => dragStart(i, event),
							onDragMove: dragMove,
							onDragEnd: dragEnd,
						}),
					),
				),
				h(
					'div',
					{ className: 'sno-row-actions' },
					h(
						'button',
						{
							type: 'button',
							className: 'sno-btn primary sno-save',
							disabled: !dirty,
							onClick: () => commit(configFrom(draft, config)),
						},
						'保存',
					),
					h(
						'button',
						{
							type: 'button',
							className: 'sno-btn sno-reset',
							onClick: () => {
								const reset = defaultConfig();
								setConfig(reset);
								saveConfig(reset);
								const live = collectItems(document);
								setItems(live);
								setDraft(editableList(live, reset));
								setDirty(false);
								setDragFrom(-1);
								setDropAt(-1);
								applyToNav(document);
							},
						},
						'恢复默认',
					),
					h('span', { className: 'sno-note' }, `已检测到 ${items.length} 个菜单项`),
				),
			);
		}

		/**
		 * 挂载：把设置页注册进 `settings.section`，并在每次设置面板出现时重排导航。
		 * 用 MutationObserver 而不是定时器：面板是 portal，打开/关闭都表现为 body 子树变化。
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject('settings.section', () =>
				ctx.slots.register({
					name: 'settings.section',
					id: 'settings-nav-order',
					order: 900,
					label: () => PANEL_LABEL,
				}, SettingsNavPanel),
			), 'dsh-settings-nav-order: settings page');

			ctx.effect(() => {
				if (typeof document === 'undefined') return () => {};
				ensureStyles(document);
				applyToNav(document);
				// 非浏览器环境（单测里）没有 MutationObserver：退化成「只在挂载时应用一次」。
				if (typeof MutationObserver === 'undefined') return () => {};
				// 观察的是整个 body 子树，聊天区流式输出会让它每帧触发很多次，
				// 所以用 requestAnimationFrame 合并成「每帧最多重排一次」。
				let frame = 0;
				const schedule = () => {
					if (frame) return;
					if (typeof requestAnimationFrame !== 'function') {
						applyToNav(document);
						return;
					}
					frame = requestAnimationFrame(() => {
						frame = 0;
						applyToNav(document);
					});
				};
				const observer = new MutationObserver(schedule);
				observer.observe(document.body, { childList: true, subtree: true });
				return () => {
					observer.disconnect();
					if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
					frame = 0;
				};
			}, 'dsh-settings-nav-order: nav order');
		}

		exports.STORE_KEY = STORE_KEY;
		exports.PANEL_LABEL = PANEL_LABEL;
		exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
		exports.loadConfig = loadConfig;
		exports.saveConfig = saveConfig;
		exports.groupIndexes = groupIndexes;
		exports.collectItems = collectItems;
		exports.matchIndexes = matchIndexes;
		exports.computeOrder = computeOrder;
		exports.hiddenIndexes = hiddenIndexes;
		exports.moveTo = moveTo;
		exports.moveItem = moveItem;
		exports.dropIndex = dropIndex;
		exports.adjustDrop = adjustDrop;
		exports.applyToNav = applyToNav;
		exports.SettingsNavPanel = SettingsNavPanel;
		exports.apply = apply;
		exports.inject = ['slots'];
		return module.exports;
	},
});