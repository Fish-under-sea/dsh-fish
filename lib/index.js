/**
 * dsh-fish —— Fish 自建插件聚合包的宿主半边。
 *
 * 本包本身不实现任何功能，只做三件事：
 *
 *   1. 把三个自建插件的宿主行插入 web profile 的 roster
 *      （见包根 cordis.patch.yml，由 `dsh plugin add dsh-fish` 展开）；
 *   2. 提供一个「外壳行」实现，让每个子插件在自己的隔离边界里启动 ——
 *      某个子插件 import 或 start 失败时，只记 degraded，不会拖垮整个宿主
 *      启动（这是聚合包相对「直接写三行 insert」的关键收益）；
 *   3. 把 degraded 状态通过同源 API 暴露出来，便于排查。
 *
 * 外壳行的 config 形如：
 *   - id: fish-session-title-refresh
 *     name: dsh-fish/session-title-refresh
 *     config:
 *       plugin: dsh-session-title-refresh
 *       config: { ...给真实插件的配置... }
 *
 * @module dsh-fish
 */

/** 进程级共享状态：外壳行可能被多个 entry 各加载一份模块副本，用 Symbol 收敛到一处。 */
const STATE_KEY = Symbol.for('dsh-fish.shell-state');

function shellState() {
  const registry = globalThis;
  registry[STATE_KEY] ??= { degraded: new Map() };
  return registry[STATE_KEY];
}

/** 记录一个子插件进入 degraded（同一个插件只保留最后一次错误）。 */
function recordDegraded(plugin, stage, error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`[dsh-fish] 子插件降级（${stage}）：${plugin}\n${message}`);
  shellState().degraded.set(plugin, {
    plugin,
    stage,
    message,
    at: new Date().toISOString(),
  });
}

/** 当前所有 degraded 子插件的快照。 */
export function listDegraded() {
  return [...shellState().degraded.values()];
}

/**
 * 外壳行的 apply：把 config.plugin 指名的真实插件挂到隔离边界后启动。
 *
 * 没有 config.plugin 时安静返回 —— 允许用户在 profile 里写一行
 * 空的 dsh-fish 覆盖行来调整包顺序，而不至于报错。
 */
export async function apply(ctx, config) {
  const spec = config?.plugin;

  if (typeof spec !== 'string' || spec === '') {
    if (config !== undefined && config !== null && typeof config === 'object' && Object.keys(config).length > 0) {
      console.warn('[dsh-fish] 外壳行缺少 config.plugin，该行未挂载任何插件。');
    }
    return;
  }

  let mod;
  try {
    mod = await import(/* @vite-ignore */ spec);
  } catch (error) {
    recordDegraded(spec, 'import', error);
    return;
  }

  const plugin = mod?.default ?? mod;
  const usable =
    typeof plugin === 'function' ||
    (typeof plugin === 'object' && plugin !== null && typeof plugin.apply === 'function');
  if (!usable) {
    recordDegraded(spec, 'shape', new Error('模块没有可用的插件形状（应为函数或 { apply }）'));
    return;
  }

  try {
    const fiber = ctx.plugin(plugin, config?.config);
    Promise.resolve(fiber).then(
      () => {},
      (error) => recordDegraded(spec, 'start', error),
    );
  } catch (error) {
    recordDegraded(spec, 'start', error);
  }
}

/** 外壳行不需要任何服务，必须在其它东西之前激活。 */
export const inject = [];