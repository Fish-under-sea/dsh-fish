/**
 * dsh-git-sync — Web GUI 半边。
 *
 * 在「设置」分区注入一个「Git 同步」页：显示仓库状态，并用按钮完成
 * 采集 / 推送 / 还原 / 密钥体检。宿主半边见 lib/index.js。
 *
 * 这里不用 JSX，直接用 react.createElement，也不 require 任何
 * @deepseek-ai/* 客户端包 —— 只依赖加载器提供的 react。
 */
window.__ModuleLoader__.load({
	id: 'dsh-git-sync',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
		const react = require('react');
		const h = react.createElement;

		const API = '/dsh-git-sync/api';

		const styles = `
.dgs-page{display:flex;flex-direction:column;gap:13px;max-width:760px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.dgs-page h3{margin:0;font-size:18px;font-weight:600}
.dgs-note{padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary)}
.dgs-note.key{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.dgs-note.warn{border-color:#c9a227;color:var(--dsw-alias-label-primary)}
.dgs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}
.dgs-card{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:11px;background:var(--dsw-alias-bg-layer-3)}
.dgs-card strong{display:block;margin-bottom:3px;font-weight:600;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dgs-card span{font-size:13px;word-break:break-all}
.dgs-card .mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}
.dgs-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.dgs-row input[type=text]{flex:1;min-width:240px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:ui-monospace,Consolas,monospace;font-size:12px}
.dgs-btn{padding:6px 13px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font-size:13px}
.dgs-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
.dgs-btn.primary{border-color:var(--dsw-alias-brand-primary);font-weight:600}
.dgs-btn:disabled{opacity:.5;cursor:default}
.dgs-chk{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dgs-log{margin:0;padding:11px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow:auto}
`;

		function statusCard(label, value, mono) {
			return h('div', { className: 'dgs-card', key: label },
				h('strong', null, label),
				h('span', { className: mono ? 'mono' : undefined }, value));
		}

		function Panel() {
			const [status, setStatus] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [log, setLog] = react.useState([]);
			const [repoDir, setRepoDir] = react.useState('');
			const [opts, setOpts] = react.useState({ sessions: true, attachments: true, autoPush: false });

			const applyStatus = (data) => {
				setStatus(data);
				if (typeof data?.repoDir === 'string') setRepoDir(data.repoDir);
				if (typeof data?.includeSessions === 'boolean' || typeof data?.includeAttachments === 'boolean') {
					setOpts((prev) => ({
						...prev,
						sessions: data.includeSessions ?? prev.sessions,
						attachments: data.includeAttachments ?? prev.attachments,
					}));
				}
			};

			const refresh = react.useCallback(() => {
				setError(null);
				return fetch(`${API}/status`, { credentials: 'same-origin' })
					.then(async (r) => {
						const data = await r.json();
						if (!data?.ok) throw new Error(data?.error || 'status unavailable');
						applyStatus(data);
					})
					.catch((e) => setError(String(e.message || e)));
			}, []);

			react.useEffect(() => { refresh(); }, [refresh]);

			const run = (action, extra) => {
				setBusy(true);
				setError(null);
				setLog([`▶ ${action} …`]);
				const params = new URLSearchParams({ action, ...(extra || {}) });
				return fetch(`${API}/run?${params}`, { method: 'POST', credentials: 'same-origin' })
					.then(async (r) => {
						const data = await r.json();
						setLog(Array.isArray(data?.log) ? data.log : [JSON.stringify(data)]);
						if (!data?.ok) setError(data?.error || '操作未成功，详见下方输出');
						return refresh();
					})
					.catch((e) => {
						setError(String(e.message || e));
						setLog([`✗ 请求失败：${String(e.message || e)}`]);
					})
					.finally(() => setBusy(false));
			};

			const saveConfig = () => {
				setBusy(true);
				const params = new URLSearchParams({
					repoDir,
					includeSessions: opts.sessions ? '1' : '0',
					includeAttachments: opts.attachments ? '1' : '0',
				});
				return fetch(`${API}/config?${params}`, { method: 'POST', credentials: 'same-origin' })
					.then(async (r) => {
						const data = await r.json();
						if (data?.ok) { applyStatus(data); setLog(['✓ 设置已保存']); }
						else setError(data?.error || '保存失败');
					})
					.catch((e) => setError(String(e.message || e)))
					.finally(() => setBusy(false));
			};

			const last = status?.lastRun;
			const lastText = last
				? `${last.action} · ${new Date(last.at).toLocaleString('zh-CN')} · ${last.ok ? '成功' : '失败'}`
				: '尚未运行';

			return h('div', { className: 'dgs-page' },
				h('style', null, styles),
				h('h3', null, 'Git 同步'),
				h('div', { className: 'dgs-note key' },
					'新机器请不必动api设置：DEEPSEEK_API_KEY、BAILIAN_API_KEY、BAILIAN_HE_API_KEY。'),

				error ? h('div', { className: 'dgs-note warn' }, `⚠ ${error}`) : null,
				!status && !error ? h('div', { className: 'dgs-note' }, '正在读取状态…') : null,

				status ? h('div', { className: 'dgs-grid' },
					statusCard('仓库目录', status.repoDir, true),
					statusCard('分支 / 远端', `${status.branch || '—'}  ${status.remote || '（未配置 origin）'}`, true),
					statusCard('待同步', status.pending === 0
						? '本机与仓库一致，无差异'
						: `${status.pending} 个文件有差异（新增 ${status.pendingDetail?.added ?? 0} · 变更 ${status.pendingDetail?.changed ?? 0} · 仓库多出 ${status.pendingDetail?.removed ?? 0}）`),
					statusCard('仓库内文件', `${status.files} 个 · ${status.sizeKB} KB`),
					statusCard('工作区', status.isGitRepo ? (status.dirty ? '有未提交改动' : `干净${status.ahead ? ` · 领先远端 ${status.ahead} 个提交` : ''}`) : '不是 git 仓库'),
					statusCard('上次运行', lastText),
					statusCard('DSH home', status.home, true),
				) : null,

				h('div', { className: 'dgs-row' },
					h('input', {
						type: 'text',
						value: repoDir,
						placeholder: '同步仓库的本地路径，例如 D:\\Fish-code\\DSH-sync-kit',
						onChange: (e) => setRepoDir(e.target.value),
					}),
					h('button', { className: 'dgs-btn', disabled: busy, onClick: saveConfig }, '保存设置'),
				),

				h('div', { className: 'dgs-row' },
					h('label', { className: 'dgs-chk' },
						h('input', { type: 'checkbox', checked: opts.sessions, onChange: (e) => setOpts({ ...opts, sessions: e.target.checked }) }),
						'含会话记录'),
					h('label', { className: 'dgs-chk' },
						h('input', { type: 'checkbox', checked: opts.attachments, onChange: (e) => setOpts({ ...opts, attachments: e.target.checked }) }),
						'含附件'),
				),

				h('div', { className: 'dgs-row' },
					h('button', { className: 'dgs-btn primary', disabled: busy, onClick: () => run('pull', { gitPush: '1' }) }, '一键同步'),
					h('button', { className: 'dgs-btn', disabled: busy, onClick: () => run('pull', { gitPush: '0' }) }, '仅采集并提交'),
					h('button', { className: 'dgs-btn', disabled: busy, onClick: () => run('restore') }, '从仓库还原到本机'),
					h('button', { className: 'dgs-btn', disabled: busy, onClick: () => run('check') }, '密钥体检'),
					h('button', { className: 'dgs-btn', disabled: busy, onClick: refresh }, '刷新'),
				),

				h('div', { className: 'dgs-note' },
					'「一键同步」= 采集 → 提交 → 推送，日常用这一个就够。',
					h('br'),
					'它也会补推之前没推上去的提交，所以推送失败后不用做别的，再点一次即可。',
					h('br'),
					'「仅采集并提交」只提交、不推送 —— 想先看一眼差异再决定推不推时用它。'),

				busy ? h('div', { className: 'dgs-note' }, '正在执行，请稍候…（涉及网络推送时可能需要几秒）') : null,

				log.length ? h('pre', { className: 'dgs-log' }, log.join('\n')) : null,

				h('div', { className: 'dgs-note' },
					'采集走白名单：插件清单、插件启用状态、插件配置、本地设置、',
					'Skill（skills/）、agent 预设、工作区映射、会话记录、附件。',
					h('br'),
					'个别文件读不到（被锁定 / 被文件策略拒绝）只会跳过并在上方列出，不会中断整次同步。',
					h('br'),
					'密钥文件（.credentials.yaml 等）在硬黑名单里，永不搬运；提交前还会复查暂存区，发现密钥类文件立即中止。',
					h('br'),
					'不做 force push，不重写历史。还原会先把被覆盖的文件备份到仓库的 _backup/ 目录。'),
			);
		}

		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
				name: 'settings.section',
				id: 'dsh-git-sync',
				order: 60,
				label: () => 'Git 同步',
			}, Panel)), 'dsh-git-sync: 同步设置页');
		}

		exports.Panel = Panel;
		exports.apply = apply;
		exports.inject = ['slots'];
		return module.exports;
	},
});