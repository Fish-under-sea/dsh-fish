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
 * 数据放两处，各有各的职责：
 *   - **工作副本**是浏览器 localStorage（键 dsh-settings-nav-order/v1，加 hidden
 *     字段时沿用同一个键，老数据照读）——它决定当次渲染，读写都不经网络；
 *   - **镜像**落在宿主的 $DSH_HOME/dsh-settings-nav-order/state.json（宿主半边
 *     lib/index.js 的通道）：保存时把快照推上去，启动时按 reconcile 的规则回填。
 *     dsh-git-sync 的白名单收录那个文件，所以换成另一台机器也能复原。
 * localStorage 里另有第二个键记着「上一次与宿主对齐过的那份原文」，用来区分
 * 「本地没动过」与「本地有还没推上去的改动」。
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

		/** 宿主偏好文件通道（由宿主半边 lib/index.js 注册的同源路由）。 */
		const SYNC_API = '/dsh-settings-nav-order/api';

		/**
		 * 第二个 localStorage 键：上一次与宿主对齐成功的那份配置**原文**。
		 *
		 * 启动对账靠它区分两件表面上一样的事 ——「本地没动过」（可以采用宿主里更新的
		 * 那份）与「本地有还没推上去的改动」（必须保留本地，否则一次失败的推送就会
		 * 静默丢掉用户刚做的调整）。存原文而不是解析后的对象：逐字比较，不做语义等价
		 * 的猜测；这个键本身丢了最坏也只是多重推一次。
		 */
		const SYNCED_KEY = 'dsh-settings-nav-order/v1.synced';

		/** 本页自己的菜单名。它同时是「唯一能取消隐藏的入口」，所以永远不许被隐藏。 */
		const PANEL_LABEL = '设置导航顺序';

		/** 出厂状态：启用、没有自定义顺序、没有隐藏项（即保持各插件自己的样子）。 */
		const DEFAULT_CONFIG = { enabled: true, order: [], hidden: [] };

		/** 出厂状态的新副本：数组不能共用，免得谁改了配置把常量带脏。 */
		function defaultConfig() {
			return { enabled: true, order: [], hidden: [] };
		}

		/**
		 * 保存后宿主文件的三种回执文案。
		 *
		 * 为什么要有这个：推送是异步的，失败时如果什么都不显示，用户会以为「我保存了，
		 * 所以仓库里也有了」—— 那正是 dsh-git-sync 修过的「静默空操作被报成成功」。
		 * 三档如实对应三种真实状态：正在写、写进去了、没写进去（本地已生效）。
		 */
		const SYNC_PENDING = '宿主文件：正在写入…';
		const SYNC_DONE = '宿主文件：已同步 —— Git 同步会带上这份偏好，换机可复原。';
		const SYNC_FAILED = '宿主文件：未同步 —— 本地已生效；宿主通道恢复后，下次打开设置页会自动重推。';

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

		// ── 宿主偏好文件通道：换机复原靠这一段 ──────────────────────────────

		/**
		 * 只走 window.fetch（不写裸 fetch）：单测里的假 window 没有它就等于「宿主
		 * 不可达」，不会真的发网络请求；真实浏览器里 window.fetch 就是 fetch。
		 */
		function syncFetch(pathname, options) {
			const target = typeof window === 'undefined' ? null : window;
			if (!target || typeof target.fetch !== 'function') return null;
			try {
				return target.fetch(`${SYNC_API}${pathname}`, { credentials: 'same-origin', ...(options ?? {}) });
			} catch {
				return null;
			}
		}

		/** 读配置原文；读不到（没配过、隐私模式）一律 null。 */
		function readRaw() {
			try {
				return window.localStorage.getItem(STORE_KEY);
			} catch {
				return null;
			}
		}

		/** 读「上次与宿主对齐过的原文」。 */
		function readSynced() {
			try {
				return window.localStorage.getItem(SYNCED_KEY);
			} catch {
				return null;
			}
		}

		/** 记下对齐过的原文；记不进去只影响下次对账的判断（最坏是多推一次）。 */
		function writeSynced(raw) {
			try {
				window.localStorage.setItem(SYNCED_KEY, raw);
			} catch {
				/* 忽略 */
			}
		}

		/**
		 * 把宿主回给的那份快照规范化。形状不对（null、数组、字符串、坏行）一律当成
		 * 「没有快照」——绝不用它覆盖本地。返回 `{ raw, config }`（raw 是规范化原文）。
		 */
		function normalizeRemote(value) {
			if (value === null || value === undefined) return null;
			if (typeof value !== 'object' || Array.isArray(value)) return null;
			const config = {
				enabled: value.enabled !== false,
				order: normalizeRows(value.order),
				hidden: normalizeRows(value.hidden),
			};
			return { raw: JSON.stringify(config), config };
		}

		/**
		 * 把当前配置推给宿主（宿主落盘 → dsh-git-sync 采集 → 进配置仓）。
		 *
		 * 失败静默：宿主不可达（还没重启、进程刚起来、路由缺失）时本地偏好照常生效，
		 * 并且**不记指纹** —— 下次启动对账会判定「本地有未同步改动」，自动重推一次。
		 */
		function pushState() {
			const raw = readRaw();
			if (raw === null) return Promise.resolve(false);
			const request = syncFetch('/state', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: raw,
			});
			if (!request) return Promise.resolve(false);
			return Promise.resolve(request)
				.then((response) => (response && response.ok ? response.json() : null))
				.then((data) => {
					if (!data || data.ok !== true) return false;
					// 记的是「刚推上去的那份原文」＝宿主现在持有的内容；此后本地再改，
					// 原文与指纹不同，对账据此判定「本地有改动」。
					writeSynced(raw);
					return true;
				})
				.catch(() => false);
		}

		/** 采用宿主快照：写回 localStorage、记指纹、立刻重排导航。 */
		function adoptRemote(remote, document) {
			try {
				window.localStorage.setItem(STORE_KEY, remote.raw);
			} catch {
				return false;
			}
			writeSynced(remote.raw);
			applyToNav(document);
			return true;
		}

		/**
		 * 启动对账：宿主的偏好文件是跨机复原的来源，但不能盖掉本地还没推上去的改动。
		 * 四条规则逐条对应一次真实场景 ——
		 *
		 *   1. 宿主没有快照（第一次同步、新机器、文件被清掉）→ 本地就是唯一来源，推上去。
		 *      没有这条，「升级前就存在的顺序」永远进不了仓库，得先手动改一次。
		 *   2. 本地没有配置（换机、清过站点数据）→ 直接采用宿主。**复原路径就是这一条。**
		 *   3. 本地与指纹逐字相同（本地没动过）→ 采用宿主里更新的那份。
		 *   4. 本地与指纹不同（有未同步的改动）→ 保留本地并推上去。宁可这次不动，也不
		 *      静默丢掉用户刚做的调整。
		 *
		 * 任何一步出错（宿主没有这条路由、返回 500、body 不是 JSON）都只是「这次不对账」，
		 * 本地顺序照旧，绝不影响已经生效的偏好。
		 */
		function reconcile(document) {
			const request = syncFetch('/state');
			if (!request) return Promise.resolve(false);
			return Promise.resolve(request)
				.then((response) => (response && response.ok ? response.json() : null))
				.then((data) => {
					if (!data || data.ok !== true) return false;
					const remote = normalizeRemote(data.state);
					const raw = readRaw();
					if (remote === null) return pushState().then(() => false);
					if (raw === null) return adoptRemote(remote, document);
					if (raw === readSynced()) {
						if (remote.raw === raw) return false;
						return adoptRemote(remote, document);
					}
					return pushState().then(() => false);
				})
				.catch(() => false);
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
			/** 保存后宿主文件的回执（空字符串＝本次还没保存过）。 */
			const [syncNote, setSyncNote] = react.useState('');
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

			/**
			 * 草稿与某份配置是否已经一致（只比顺序与隐藏 —— 草稿里没有 enabled）。
			 *
			 * 用途只有一个：决定 commit 之后 dirty 该是什么。**不能一律置 false**：
			 * 「启用」复选框走的是 commit({...config, enabled})，提交的是**已保存**
			 * 的顺序，草稿里的拖动/隐藏并没有进配置。这时如果谎报「已保存」，用户
			 * 会以为刚排好的顺序已经存住了 —— 正是这个插件最不该有的那种假成功。
			 */
			const draftMatches = (rows, config) =>
				JSON.stringify(toSavedRows(rows)) === JSON.stringify(config.order)
				&& JSON.stringify(toSavedRows(rows.filter((row) => row.hidden))) === JSON.stringify(config.hidden);

			/** 推给宿主并如实回报结果 —— 成功/失败都要看得见，不假装成功。 */
			const syncToHost = () => {
				setSyncNote(SYNC_PENDING);
				return pushState().then((ok) => setSyncNote(ok ? SYNC_DONE : SYNC_FAILED));
			};

			const commit = (next) => {
				setConfig(next);
				saveConfig(next);
				applyToNav(document);
				setDirty(!draftMatches(draft, next));
				// 落盘之后顺手推给宿主：dsh-git-sync 采集的是那个文件，不是 localStorage。
				syncToHost();
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
					'按住每行左边的 ⋮⋮ 拖动就能排序（也可以点 ↑ / ↓）；不想看到某一项，点「隐藏」把它从左侧菜单收起来——插件本身照常工作，随时点「显示」找回来。保存后立即生效，不动任何插件的代码，插件更新也不会丢。偏好同时落在浏览器（localStorage，当场生效）与宿主文件（$DSH_HOME/dsh-settings-nav-order/state.json，供 Git 同步跨机复原）：换机装好本插件、把配置仓还原到本机之后，打开设置页即自动恢复，不必手工重排。',
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
				syncNote
					? h('div', { className: syncNote === SYNC_FAILED ? 'sno-note warn' : 'sno-note' }, syncNote)
					: null,
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
								syncToHost();
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

			// 启动对账：把宿主文件里的偏好回填到 localStorage（换机复原路径），或反过来
			// 把本地还没推上去的改动推给宿主。整段异步、失败静默 —— 顺序本身不依赖网络，
			// 宿主半边不在（老版本、没起 webServer）时一切照旧。
			ctx.effect(() => {
				reconcile(typeof document === 'undefined' ? undefined : document);
				return () => {};
			}, 'dsh-settings-nav-order: 偏好文件对账');
		}

		exports.STORE_KEY = STORE_KEY;
		exports.SYNCED_KEY = SYNCED_KEY;
		exports.SYNC_API = SYNC_API;
		exports.SYNC_PENDING = SYNC_PENDING;
		exports.SYNC_DONE = SYNC_DONE;
		exports.SYNC_FAILED = SYNC_FAILED;
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
		exports.normalizeRemote = normalizeRemote;
		exports.pushState = pushState;
		exports.reconcile = reconcile;
		exports.readSynced = readSynced;
		exports.SettingsNavPanel = SettingsNavPanel;
		exports.apply = apply;
		exports.inject = ['slots'];
		return module.exports;
	},
});