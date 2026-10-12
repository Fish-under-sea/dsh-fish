/**
 * 依赖图构建与分层布局（对齐 skill-lens 主项目的 FR-08 口径，文件为主）：
 * 三层结构 SKILL.md → 分类节点（文档/脚本/资产/未引用/外部）→ 叶子节点。
 * - 叶子以技能目录文件清单为准：被 SKILL.md 引用的归入对应分类，未被引用的挂"未引用"；
 * - 提取到但目录中不存在的引用不生成节点（目录里没有的文件不显示）；
 * - 外部引用（URL/环境变量/命令）作为外部分类的叶子。
 */

export type FileCategory = "document" | "script" | "asset" | "unref";
export type ExternalCategory = "external-url" | "env-var" | "external-command";
/** 技能目录之外的共享资源（如 `../skill-refs/<file>`），单列一类与技能自带文件区分 */
export type ReferencedCategory = "referenced";

export type NodeKind = "root" | FileCategory | ExternalCategory | ReferencedCategory;

/** 由 host 解析出的技能外部引用；target 与引用原文一致，便于精确配对 */
export interface ExternalFile {
  /** 引用原文（与 extractReferences 产出的 target 相同） */
  target: string;
  /** 真实绝对路径 */
  path: string;
  /** 展示名（相对 DSH_HOME 的路径，如 skill-refs/design-essence/scripts/detect.mjs） */
  label: string;
}

export interface DepNode {
  /** 文件节点的 id 是技能目录内 posix 相对路径；分类/根节点是特殊前缀 id */
  id: string;
  label: string;
  kind: NodeKind;
  /** 分类节点为 true */
  isGroup?: boolean;
  line?: number;
}

export interface DepEdge {
  source: string;
  target: string;
}

const SCRIPT_EXT = /\.(py|sh|bash|zsh|js|mjs|cjs|ts|tsx|rb|ps1)$/i;

function classify(target: string): "document" | "script" | "asset" {
  if (/\.mdx?$/i.test(target)) return "document";
  if (SCRIPT_EXT.test(target)) return "script";
  return "asset";
}

/** 在技能目录文件清单（posix 相对路径）中解析引用目标 */
function resolveTarget(target: string, files: string[]): string | null {
  const clean = target.split("#")[0].split("?")[0].replace(/^\.\//, "").replace(/\/+$/, "");
  if (clean === "") return null;
  const direct = files.find((f) => f === clean);
  if (direct) return direct;
  const directCi = files.find((f) => f.toLowerCase() === clean.toLowerCase());
  if (directCi) return directCi;
  const base = clean.split("/").pop() ?? clean;
  return (
    files.find((f) => f.split("/").pop() === base)
    ?? files.find((f) => (f.split("/").pop() ?? "").toLowerCase() === base.toLowerCase())
    ?? null
  );
}

const DEFAULT_ROOT_ID = "SKILL.md";
const UNREF_ID = "group:unref";
const GROUP_IDS: Record<"document" | "script" | "asset", string> = {
  document: "group:document",
  script: "group:script",
  asset: "group:asset",
};
const EXT_GROUP_ID = "group:external";
const REF_GROUP_ID = "group:referenced";

export interface GraphResult {
  nodes: DepNode[];
  edges: DepEdge[];
}

export function buildDependencyGraph(input: {
  references: { kind: string; target: string; line: number }[];
  skillFiles: string[];
  /** 技能目录之外、由 host 解析成功的共享资源；命中的引用归入「引用资源」 */
  externalFiles?: ExternalFile[];
  /** 入口节点名（目录式为 SKILL.md；扁平式为技能文件名） */
  rootLabel?: string;
}): GraphResult {
  const rootId = input.rootLabel && input.rootLabel !== "" ? input.rootLabel : DEFAULT_ROOT_ID;
  const externalFiles = input.externalFiles ?? [];
  const externalByTarget = new Map<string, ExternalFile>();
  for (const file of externalFiles) externalByTarget.set(file.target, file);

  const nodes = new Map<string, DepNode>([
    [rootId, { id: rootId, label: rootId, kind: "root" }],
  ]);
  const edges: DepEdge[] = [];
  const ensureGroup = (id: string, label: string, kind: NodeKind): void => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label, kind, isGroup: true });
      edges.push({ source: rootId, target: id });
    }
  };

  // 引用 → 分类归属（文件相对路径 → 分类）；目录中不存在的引用忽略
  const fileCategory = new Map<string, "document" | "script" | "asset">();
  const externals: { kind: ExternalCategory; target: string; line: number }[] = [];
  const referencedExt = new Map<string, ExternalFile>();

  for (const ref of input.references) {
    if (ref.kind === "relative-path") {
      const resolved = resolveTarget(ref.target, input.skillFiles);
      if (resolved !== null) {
        if (!fileCategory.has(resolved)) fileCategory.set(resolved, classify(ref.target));
        continue;
      }
      // 技能目录内找不到：看 host 是否在资源根里解析到了同一引用
      const external = externalByTarget.get(ref.target);
      if (external !== undefined) referencedExt.set(`ext:${external.path}`, external);
    } else if (ref.kind === "url") {
      externals.push({ kind: "external-url", target: ref.target, line: ref.line });
    } else if (ref.kind === "env-var") {
      externals.push({ kind: "env-var", target: ref.target, line: ref.line });
    } else if (ref.kind === "command") {
      const first = ref.target.trim().split(/\s+/)[0] ?? "";
      if (first !== "") externals.push({ kind: "external-command", target: first.toLowerCase(), line: ref.line });
    }
  }

  // 有引用的文件 → 对应分类叶子
  for (const [file, category] of fileCategory) {
    ensureGroup(GROUP_IDS[category], groupLabel(category), category);
    nodes.set(file, { id: file, label: file, kind: category });
    edges.push({ source: GROUP_IDS[category], target: file });
  }

  // 技能目录之外的共享资源 → "引用资源"分类
  if (referencedExt.size > 0) {
    ensureGroup(REF_GROUP_ID, "引用资源", "referenced");
    for (const [id, external] of referencedExt) {
      nodes.set(id, { id, label: external.label, kind: "referenced" });
      edges.push({ source: REF_GROUP_ID, target: id });
    }
  }

  // 未引用文件 → "未引用"分类
  const referencedSet = new Set(fileCategory.keys());
  const unrefFiles = input.skillFiles.filter((f) => f !== rootId && !referencedSet.has(f));
  if (unrefFiles.length > 0) {
    ensureGroup(UNREF_ID, "未引用", "unref");
    for (const file of unrefFiles) {
      nodes.set(file, { id: file, label: file, kind: "unref" });
      edges.push({ source: UNREF_ID, target: file });
    }
  }

  // 外部引用（URL/环境变量/命令）→ 外部分类叶子
  if (externals.length > 0) {
    ensureGroup(EXT_GROUP_ID, "外部", "external-url");
    const seenExt = new Set<string>();
    for (const ext of externals) {
      const label = ext.kind === "external-url" ? ext.target
        : ext.kind === "env-var" ? `$${ext.target}`
        : ext.target;
      const id = `${ext.kind}:${ext.target}`;
      if (seenExt.has(id)) continue;
      seenExt.add(id);
      nodes.set(id, { id, label, kind: ext.kind, line: ext.line });
      edges.push({ source: EXT_GROUP_ID, target: id });
    }
  }

  return { nodes: [...nodes.values()], edges };
}

function groupLabel(category: "document" | "script" | "asset"): string {
  return category === "document" ? "文档" : category === "script" ? "脚本" : "资产";
}

// ---------- 分层布局：从根出发按邻接深度排布，同层按序垂直排列 ----------

export interface LayoutNode extends DepNode {
  x: number;
  y: number;
}

export const NODE_W = 200;
export const NODE_H = 34;
const GAP_X = 72;
const GAP_Y = 14;

export function layoutGraph(
  nodes: DepNode[],
  edges: DepEdge[],
  rootId: string = DEFAULT_ROOT_ID,
): { laid: LayoutNode[]; width: number; height: number } {
  const children = new Map<string, string[]>();
  for (const e of edges) {
    const list = children.get(e.source) ?? [];
    list.push(e.target);
    children.set(e.source, list);
  }

  const depth = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of children.get(cur) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, depth.get(cur)! + 1);
        queue.push(next);
      }
    }
  }

  const byLayer = new Map<number, DepNode[]>();
  for (const node of nodes) {
    const d = depth.get(node.id) ?? 0;
    const list = byLayer.get(d) ?? [];
    list.push(node);
    byLayer.set(d, list);
  }

  // 同层内按所属分组的边顺序排列，保证分组叶子视觉上聚拢
  const laid: LayoutNode[] = [];
  let maxRows = 0;
  for (const [d, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    maxRows = Math.max(maxRows, list.length);
    list.forEach((node, i) => {
      laid.push({ ...node, x: d * (NODE_W + GAP_X), y: i * (NODE_H + GAP_Y) });
    });
  }

  const width = byLayer.size * (NODE_W + GAP_X);
  const height = Math.max(1, maxRows) * (NODE_H + GAP_Y);
  return { laid, width, height };
}
