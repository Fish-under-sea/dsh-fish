/**
 * dsh-session-title-refresh —— Web GUI 半边。
 *
 * 在「设置」分区注入一页「会话标题自动刷新」：
 *   · 顶上一个推荐档位按钮，点一下就跳到推荐参数；
 *   · 首轮总结轮次 / 刷新间隔两个滑块；
 *   · 高级折叠区里调两者的极限上限、取样窗口、输入与超时预算、固定路由；
 *   · 下方列出活动会话（当前轮次、下次触发轮次）并能立即刷新某一会话；
 *   · 最近自动命名记录。
 *
 * 与 dsh-git-sync 同一套写法：不用 JSX，直接用 react.createElement，
 * 只 require('react')，不依赖任何 @deepseek-ai/* 客户端包。
 * 数据全部走宿主半边的同源 API（lib/index.js）。
 */
window.__ModuleLoader__.load({
	id: 'dsh-session-title-refresh',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
		const react = require('react');
		const h = react.createElement;

		const API = '/dsh-session-title-refresh/api';

		const styles = `
.str-page{display:flex;flex-direction:column;gap:13px;max-width:820px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.str-page h3{margin:0;font-size:18px;font-weight:600}
.str-page h4{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.str-note{padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary)}
.str-note.key{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.str-note.warn{border-color:#c9a227;color:var(--dsw-alias-label-primary)}
.str-card{padding:11px 13px;border:1px solid var(--dsw-alias-border-l2);border-radius:11px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:9px}
.str-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px}
.str-stat{padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-2)}
.str-stat strong{display:block;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary);margin-bottom:2px}
.str-stat span{font-size:13px;word-break:break-all}
.str-mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}
.str-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.str-presets{display:flex;gap:8px;flex-wrap:wrap}
.str-preset{flex:1;min-width:150px;text-align:left;padding:8px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}
.str-preset:hover{border-color:var(--dsw-alias-brand-primary)}
.str-preset.active{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-3)}
.str-preset b{display:block;font-size:13px}
.str-preset em{display:block;font-style:normal;font-size:11px;color:var(--dsw-alias-label-tertiary);margin:2px 0}
.str-preset .str-mono{color:var(--dsw-alias-label-secondary)}
.str-slider{display:flex;flex-direction:column;gap:3px;flex:1;min-width:240px}
.str-slider label{display:flex;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary)}
.str-slider label b{color:var(--dsw-alias-label-primary);font-family:ui-monospace,Consolas,monospace}
.str-slider input[type=range]{width:100%}
.str-slider small{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.str-btn{padding:6px 13px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font-size:13px}
.str-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
.str-btn.primary{border-color:var(--dsw-alias-brand-primary);font-weight:600}
.str-btn:disabled{opacity:.5;cursor:default}
.str-btn.mini{padding:3px 9px;font-size:12px}
.str-chk{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary)}
.str-num{width:88px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:ui-monospace,Consolas,monospace;font-size:12px}
.str-txt{flex:1;min-width:170px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:ui-monospace,Consolas,monospace;font-size:12px}
.str-table{width:100%;border-collapse:collapse;font-size:12px}
.str-table th,.str-table td{padding:5px 7px;border-bottom:1px solid var(--dsw-alias-border-l2);text-align:left;vertical-align:top}
.str-table th{color:var(--dsw-alias-label-tertiary);font-weight:600}
.str-table td.str-mono{word-break:break-all}
.str-tag{display:inline-block;padding:1px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.str-details summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px}
.str-log{margin:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all;max-height:220px;overflow:auto}
`;

		/** 参数键 → 中文名（保存时只挑这些键，别的字段一律不碰）。 */
		const NUMBER_FIELDS = [
			['firstRound', '首轮总结轮次'],
			['interval', '刷新间隔（轮）'],
			['maxFirstRound', '首轮轮次可调上限'],
			['maxInterval', '间隔可调上限'],
			['windowSize', '取样条数'],
			['maxInputBytes', '输入字节预算'],
			['maxOutputTokens', '输出 token 上限'],
			['timeoutMs', '超时（毫秒）'],
			['targetWords', '非中文目标词数'],
			['targetCjkCharacters', '中文目标字数'],
		];
		const BOOLEAN_FIELDS = [
			['enabled', '启用自动刷新'],
			['skipSubagentSessions', '跳过子代理会话'],
			['keepRefreshingAfterManualRename', '人工改名后仍继续刷新'],
		];

		/** 只把已知字段挑出来发给宿主（宿主仍会夹紧）。 */
		function pickConfig(form) {
			const patch = {};
			for (const [key] of NUMBER_FIELDS) {
				const value = Number.parseInt(form[key], 10);
				if (Number.isFinite(value)) patch[key] = value;
			}
			for (const [key] of BOOLEAN_FIELDS) patch[key] = Boolean(form[key]);
			patch.provider = String(form.provider ?? '').trim();
			patch.model = String(form.model ?? '').trim();
			return patch;
		}

		function describeConfig(config) {
			if (!config) return '';
			return `第 ${config.firstRound} 轮首次总结，之后每 ${config.interval} 轮刷新一次`;
		}

		function Slider(props) {
			return h('div', { className: 'str-slider' },
				h('label', null, props.label, h('b', null, props.value)),
				h('input', {
					type: 'range',
					min: props.min,
					max: props.max,
					step: 1,
					value: props.value,
					disabled: props.disabled,
					onChange: (event) => props.onChange(Number.parseInt(event.target.value, 10)),
				}),
				props.hint ? h('small', null, props.hint) : null,
			);
		}

		function NumberRow(props) {
			return h('label', { className: 'str-chk' },
				h('span', null, props.label),
				h('input', {
					className: 'str-num',
					type: 'number',
					min: props.min,
					max: props.max,
					value: props.value,
					disabled: props.disabled,
					onChange: (event) => props.onChange(event.target.value),
				}),
			);
		}

		function Panel() {
			const [status, setStatus] = react.useState(null);
			const [form, setForm] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [log, setLog] = react.useState([]);
			const [busy, setBusy] = react.useState(false);
			const [dirty, setDirty] = react.useState(false);

			const applyStatus = (data) => {
				setStatus(data);
				if (!dirty && data?.config) setForm({ ...data.config });
			};

			const refresh = react.useCallback(
				() =>
					fetch(`${API}/status`, { credentials: 'same-origin' })
						.then(async (response) => {
							const data = await response.json();
							if (!data?.ok) throw new Error(data?.error || '无法读取状态');
							applyStatus(data);
							setError(null);
						})
						.catch((cause) => setError(String(cause.message || cause))),
				[dirty],
			);

			react.useEffect(() => {
				refresh();
			}, [refresh]);

			/** 改一个字段：立刻本地生效，点「保存」才落盘。 */
			const patch = (changes) => {
				setForm((prev) => ({ ...prev, ...changes }));
				setDirty(true);
			};

			const save = () => {
				setBusy(true);
				setError(null);
				return fetch(`${API}/config`, {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(pickConfig(form)),
				})
					.then(async (response) => {
						const data = await response.json();
						if (!data?.ok) throw new Error(data?.error || '保存失败');
						setDirty(false);
						applyStatus(data);
						setLog([`✓ 已保存：${describeConfig(data.config)}`]);
					})
					.catch((cause) => setError(String(cause.message || cause)))
					.finally(() => setBusy(false));
			};

			const refreshNow = (sessionId) => {
				setBusy(true);
				setError(null);
				return fetch(`${API}/refresh`, {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(sessionId ? { sessionId } : {}),
				})
					.then(async (response) => {
						const data = await response.json();
						const lines = [];
						for (const item of data?.refreshed ?? []) lines.push(`✓ ${item.sessionId} → ${item.title ?? '(无标题)'}`);
						for (const item of data?.failed ?? []) lines.push(` ${item.sessionId} → ${item.error}`);
						if (!lines.length) lines.push('没有可刷新的活动会话。');
						setLog(lines);
						if (data?.error) setError(data.error);
						applyStatus(data);
					})
					.catch((cause) => setError(String(cause.message || cause)))
					.finally(() => setBusy(false));
			};

			if (error && !status) {
				return h('div', { className: 'str-page' }, h('style', null, styles), h('h3', null, '会话标题自动刷新'), h('div', { className: 'str-note warn' }, `⚠ ${error}`));
			}
			if (!status || !form) {
				return h('div', { className: 'str-page' }, h('style', null, styles), h('h3', null, '会话标题自动刷新'), h('div', { className: 'str-note' }, '正在读取状态…'));
			}

			const bounds = status.bounds ?? {};
			const presets = status.presets ?? [];
			const sessions = status.sessionList ?? [];
			const records = status.log ?? [];

			const isPresetActive = (preset) => form.firstRound === preset.firstRound && form.interval === preset.interval;

			return h('div', { className: 'str-page' },
				h('style', null, styles),
				h('h3', null, `会话标题自动刷新${status.version ? ` v${status.version}` : ''}`),
				h('div', { className: 'str-note key' },
					'与一个会话对话到设定的轮次后，agent 会总结这次会话的方向并自动命名；此后每隔若干轮再刷新一次标题。',
					h('br'),
					'标题生成是一次独立的辅助模型调用：不进主对话、不增加主请求 token、也不拖慢回答。'),
				h('div', { className: 'str-note' }, `当前规则：${describeConfig(form)}${form.enabled ? '' : ' · 已停用'}`),

				error ? h('div', { className: 'str-note warn' }, `⚠ ${error}`) : null,

				h('div', { className: 'str-card' },
					h('h4', null, '推荐档位'),
					h('div', { className: 'str-presets' },
						...presets.map((preset) =>
							h('button', {
								key: preset.id,
								className: `str-preset${isPresetActive(preset) ? ' active' : ''}`,
								disabled: busy,
								onClick: () => patch({ firstRound: preset.firstRound, interval: preset.interval }),
							},
								h('b', null, `${preset.label}${preset.recommended ? '（推荐）' : ''}`),
								h('em', null, preset.hint),
								h('span', { className: 'str-mono' }, `第 ${preset.firstRound} 轮 / 每 ${preset.interval} 轮`),
							),
						),
					),
					h('small', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
						'点档位只是填参数，还要点下面的「保存设置」才生效。'),
				),

				h('div', { className: 'str-card' },
					h('div', { className: 'str-row' },
						h(Slider, {
							label: '首次总结轮次',
							value: form.firstRound,
							min: 1,
							max: form.maxFirstRound,
							disabled: busy,
							hint: `可调范围 1 – ${form.maxFirstRound}（上限本身可在「高级」里改）`,
							onChange: (value) => patch({ firstRound: value }),
						}),
						h(Slider, {
							label: '刷新间隔（轮）',
							value: form.interval,
							min: 1,
							max: form.maxInterval,
							disabled: busy,
							hint: `可调范围 1 – ${form.maxInterval}（上限本身可在「高级」里改）`,
							onChange: (value) => patch({ interval: value }),
						}),
					),
					h('div', { className: 'str-row' },
						h('label', { className: 'str-chk' },
							h('input', {
								type: 'checkbox',
								checked: form.enabled,
								disabled: busy,
								onChange: (event) => patch({ enabled: event.target.checked }),
							}),
							'启用自动刷新',
						),
						h('label', { className: 'str-chk' },
							h('input', {
								type: 'checkbox',
								checked: form.keepRefreshingAfterManualRename,
								disabled: busy,
								onChange: (event) => patch({ keepRefreshingAfterManualRename: event.target.checked }),
							}),
							'我手动改过名字后仍继续刷新（默认不覆盖你的命名）',
						),
					),
				),

				h('details', { className: 'str-details str-card' },
					h('summary', null, '高级：极限阈值与生成预算'),
					h('div', { className: 'str-row' },
						h(NumberRow, { label: '首轮轮次可调上限', value: form.maxFirstRound, min: 1, max: 50, disabled: busy, onChange: (value) => patch({ maxFirstRound: value }) }),
						h(NumberRow, { label: '刷新间隔可调上限', value: form.maxInterval, min: 1, max: 100, disabled: busy, onChange: (value) => patch({ maxInterval: value }) }),
					),
					h('small', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
						'这两个就是滑块能推到的最大值：把上限调小，滑块的可用范围随之收窄；调大则允许更晚首刷、更长间隔。'),
					h('div', { className: 'str-row' },
						h(NumberRow, { label: '取样条数', value: form.windowSize, min: 2, max: 40, disabled: busy, onChange: (value) => patch({ windowSize: value }) }),
						h(NumberRow, { label: '输入字节预算', value: form.maxInputBytes, min: 256, max: 65536, disabled: busy, onChange: (value) => patch({ maxInputBytes: value }) }),
						h(NumberRow, { label: '输出 token 上限', value: form.maxOutputTokens, min: 16, max: 512, disabled: busy, onChange: (value) => patch({ maxOutputTokens: value }) }),
						h(NumberRow, { label: '超时（毫秒）', value: form.timeoutMs, min: 5000, max: 300000, disabled: busy, onChange: (value) => patch({ timeoutMs: value }) }),
					),
					h('div', { className: 'str-row' },
						h(NumberRow, { label: '非中文目标词数', value: form.targetWords, min: 1, max: 20, disabled: busy, onChange: (value) => patch({ targetWords: value }) }),
						h(NumberRow, { label: '中文目标字数', value: form.targetCjkCharacters, min: 2, max: 40, disabled: busy, onChange: (value) => patch({ targetCjkCharacters: value }) }),
					),
					h('div', { className: 'str-row' },
						h('span', { className: 'str-chk' }, '固定路由 provider'),
						h('input', { className: 'str-txt', type: 'text', value: form.provider ?? '', disabled: busy, placeholder: '留空 = 跟随会话当前模型', onChange: (event) => patch({ provider: event.target.value }) }),
						h('span', { className: 'str-chk' }, 'model'),
						h('input', { className: 'str-txt', type: 'text', value: form.model ?? '', disabled: busy, placeholder: '留空 = 跟随会话当前模型', onChange: (event) => patch({ model: event.target.value }) }),
					),
					h('small', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
						'取样条数 = 送进标题模型的发言条数（首条 + 最近若干条）。输入字节预算会自动丢弃中段、截断长文，绝不丢首条与最新一条。'),
				),

				h('div', { className: 'str-row' },
					h('button', { className: 'str-btn primary', disabled: busy, onClick: save }, dirty ? '保存设置（有改动）' : '保存设置'),
					h('button', { className: 'str-btn', disabled: busy, onClick: () => refreshNow() }, '立即刷新所有会话标题'),
					h('button', { className: 'str-btn', disabled: busy, onClick: () => { setDirty(false); refresh(); } }, '重新读取'),
					dirty ? h('span', { className: 'str-chk' }, '· 尚未保存') : null,
				),

				busy ? h('div', { className: 'str-note' }, '正在执行，请稍候…') : null,

				h('div', { className: 'str-card' },
					h('h4', null, `活动会话（${sessions.length}）`),
					sessions.length === 0
						? h('div', { className: 'str-note' }, '本次启动后还没有会话发过言。发一条消息就会出现在这里。')
						: h('table', { className: 'str-table' },
							h('thead', null,
								h('tr', null,
									h('th', null, '会话'),
									h('th', null, '标题'),
									h('th', null, '轮次'),
									h('th', null, '下次触发'),
									h('th', null, '已刷新'),
									h('th', null, ''),
								),
							),
							h('tbody', null,
								...sessions.map((item) =>
									h('tr', { key: item.sessionId },
										h('td', { className: 'str-mono' }, item.sessionId, item.subagent ? h('span', { className: 'str-tag' }, '子代理') : null),
										h('td', null, item.title ?? h('span', { className: 'str-tag' }, '尚未命名')),
										h('td', { className: 'str-mono' }, String(item.rounds)),
										h('td', { className: 'str-mono' }, item.subagent ? '—' : String(item.nextDue)),
										h('td', { className: 'str-mono' }, String(item.refreshes)),
										h('td', null,
											h('button', {
												className: 'str-btn mini',
												disabled: busy || item.subagent,
												onClick: () => refreshNow(item.sessionId),
											}, '立即刷新'),
										),
									),
								),
							),
						),
					h('small', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
						`第 ${form.firstRound} 轮首次总结，之后每 ${form.interval} 轮刷新一次。人工改过名的会话默认不再自动刷新，仅在上表里保留轮次显示。`),
				),

				h('div', { className: 'str-card' },
					h('h4', null, '最近自动命名'),
					records.length === 0
						? h('div', { className: 'str-note' }, '还没有记录。到第 ' + form.firstRound + ' 轮时这里会出现第一条。')
						: h('pre', { className: 'str-log' },
							records
								.map((record) => {
									const when = record.at ? new Date(record.at).toLocaleString('zh-CN') : '—';
									// 三种结果要能一眼分清：成功 / 跳过（没什么可总结）/ 失败
									const mark = record.skipped ? '·' : record.ok ? '✓' : '✗';
									const where = `${record.sessionId} · 第 ${record.round} 轮${record.manual ? ' · 手动' : ''}`;
									const what = record.skipped
										? record.reason ?? '已跳过'
										: record.ok
											? record.title ?? '(无标题)'
											: record.error;
									const by = record.version ? ` [v${record.version}]` : '';
									return `${mark} ${when} ${where} → ${what}${by}`;
								})
								.join('\n'),
						),
					h('small', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
						'记录会落盘（最多 50 条），DSH 重启后依然看得到——每行末尾的 [v版本号] 用来分辨是哪一版产生的。'),
				),

				h('div', { className: 'str-note' },
					'「第几轮」数的是人类发言（插件注入的消息不计）。轮次由会话日志本身推出，',
					'所以 DSH 重启或恢复旧会话后计数依然准确；触发点对齐固定网格，',
					'重启不会补跑一串历史命名。',
					h('br'),
					'宿主侧的系统指令会要求标题概括「这次会话整体在做什么」，而不是某一处细节；',
					'生成失败（超时、无路由、模型没吐文本）只会保留旧标题并在上方记录一行，不影响对话。',
					h('br'),
					'「· 跳过」表示这个会话还没有人类发言，没什么可总结的——不是故障。',
					h('br'),
					h('span', { className: 'str-mono' }, `v${status.version ?? '?'} · ${status.configPath ?? ''}`),
					h('br'),
					h('span', { className: 'str-mono' }, status.historyPath ?? ''),
				),
			);
		}

		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
				name: 'settings.section',
				id: 'dsh-session-title-refresh',
				order: 62,
				label: () => '会话标题自动刷新',
			}, Panel)), 'dsh-session-title-refresh: 会话标题设置页');
		}

		exports.Panel = Panel;
		exports.apply = apply;
		exports.inject = ['slots'];
		return module.exports;
	},
});