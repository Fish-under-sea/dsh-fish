import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api";
import { buildDependencyGraph, layoutGraph, NODE_H, NODE_W, type DepNode, type ExternalFile } from "../deps";
import { extractConstraints, extractMetadata, extractReferences, parseFrontmatter, type SkillConstraint, type SkillMetadata } from "../parse";
import { FileBrowser } from "./file-browser";
import type { SkillEntry } from "./app";

type SubTab = "overview" | "files" | "deps";

const NODE_COLORS: Record<DepNode["kind"], string> = {
  root: "#4f7cff",
  document: "#5b8def",
  script: "#3fa96f",
  asset: "#b0853f",
  unref: "#8f8f8f",
  referenced: "#c2703f",
  "external-url": "#9b6bd4",
  "env-var": "#d4936b",
  "external-command": "#d46b8f",
};

const KIND_LABELS: Record<DepNode["kind"], string> = {
  root: "入口",
  document: "文档",
  script: "脚本",
  asset: "资产",
  unref: "未引用",
  referenced: "引用资源",
  "external-url": "外部 URL",
  "env-var": "环境变量",
  "external-command": "命令",
};

/** 技能入口文件路径：目录式为 <dir>/SKILL.md，扁平式就是技能文件本身 */
function entryPathOf(skill: SkillEntry): string {
  return skill.kind === "file" ? skill.dir : `${skill.dir}/SKILL.md`;
}

/** 入口节点标签（依赖图根节点） */
function entryNameOf(skill: SkillEntry): string {
  if (skill.kind !== "file") return "SKILL.md";
  return skill.rel.split("/").pop() ?? skill.dir.split("/").pop() ?? "SKILL.md";
}

export function SkillDetail(props: { skill: SkillEntry; onBack: () => void; onDirtyChange?: (dirty: boolean) => void }): React.ReactElement {
  const { skill, onBack } = props;
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDirty, setFileDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<SubTab | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  /**
   * 引用资源（技能目录外的共享文件）的只读预览。
   *
   * 为什么单独一个态而不复用「文件」页签：那些文件属于其它技能/共享资源目录，
   * 本插件对它们没有编辑权，也列不出同目录的兄弟文件。所以只读展示正文 +
   * 明确标注来源路径，不提供保存入口。
   */
  const [externalView, setExternalView] = useState<{ path: string; content: string | null; error: string | null } | null>(null);
  const pendingAction = useRef<"back" | "tab" | null>(null);

  // 脏状态同步给上层（app.tsx 用于拦截返回列表）
  useEffect(() => {
    props.onDirtyChange?.(fileDirty);
  }, [fileDirty, props.onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    setFilesLoading(true);
    void (async () => {
      try {
        const res = await api.files(skill.dir);
        if (!cancelled) setFiles(res.files);
      } catch {
        if (!cancelled) setFiles([]);
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skill.dir]);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    void (async () => {
      try {
        const res = await api.read(entryPathOf(skill));
        if (!cancelled) setContent(res.content);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skill]);

  const meta = useMemo<SkillMetadata | null>(() => {
    if (content === null) return null;
    const fm = parseFrontmatter(content);
    return fm.kind === "valid" ? extractMetadata(fm.data) : null;
  }, [content]);

  const refs = useMemo(() => (content === null ? [] : extractReferences(content)), [content]);

  // 技能目录之外的共享资源（`../skill-refs/<file>` 等）由 host 解析成真实路径后再入图
  const [externalFiles, setExternalFiles] = useState<ExternalFile[]>([]);
  useEffect(() => {
    let cancelled = false;
    const payload = refs
      .filter((ref) => ref.kind === "relative-path")
      .map((ref) => ({ kind: ref.kind, target: ref.target }));
    if (payload.length === 0) {
      setExternalFiles([]);
      return;
    }
    void (async () => {
      try {
        const res = await api.resolveRefs(skill.dir, payload);
        if (!cancelled) setExternalFiles(res.resolved);
      } catch {
        if (!cancelled) setExternalFiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skill.dir, refs]);

  const entryName = entryNameOf(skill);
  /**
   * 扁平技能只有一个文件（就是它自己），「文件」页签与「文件数」都没有信息量，
   * 因此对扁平技能整页隐藏；目录式技能保留（能浏览/编辑 SKILL.md 旁边的配套文件）。
   *
   * 声明位置在 rootOpen 之前：下面构造入口节点的打开方式要用它。
   */
  const isFlat = skill.kind === "file";
  /**
   * 入口文档怎么打开。
   *
   * 目录式技能：SKILL.md 就在技能目录内，用相对路径交给「文件」页签编辑。
   * 扁平技能：`skill.dir` 本身就是那个 .md 文件的绝对路径，技能目录并不存在，
   * 只能按绝对路径只读打开。
   */
  const rootOpen = useMemo(
    () => (isFlat ? { via: "external" as const, path: skill.dir } : { via: "skill" as const }),
    [isFlat, skill.dir],
  );
  const graph = useMemo(
    () => buildDependencyGraph({ references: refs, skillFiles: files, externalFiles, rootLabel: entryName, rootOpen }),
    [refs, files, externalFiles, entryName, rootOpen],
  );
  const constraints = useMemo<SkillConstraint[]>(() => (content === null ? [] : extractConstraints(content)), [content]);
  const [copied, setCopied] = useState(false);

  const displayName = useMemo(() => {
    if (meta?.name) return meta.name;
    const last = skill.rel.split("/").pop() ?? skill.rel;
    // 扁平技能的 rel 带 .md 后缀，展示时去掉
    return skill.kind === "file" ? last.replace(/\.md$/i, "") : last;
  }, [meta, skill.rel, skill.kind]);

  /**
   * 扁平技能只有一个文件（就是它自己），「文件」页签与「文件数」都没有信息量，
   * 因此对扁平技能整页隐藏；目录式技能保留（能浏览/编辑 SKILL.md 旁边的配套文件）。
   *
   * （isFlat 已提前声明，见上面的 rootOpen 之前。）
   */

  /** 复制 SKILL.md 完整内容到剪贴板 */
  const copyContent = useCallback(async (): Promise<void> => {
    if (content === null) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板 API 不可用时静默失败
    }
  }, [content]);

  /** 切换子标签：如有未保存改动则弹确认框 */
  const guardTabSwitch = useCallback((next: SubTab) => {
    if (next === subTab) return;
    if (fileDirty) {
      pendingAction.current = "tab";
      setPendingTab(next);
      setShowUnsavedDialog(true);
    } else {
      setSubTab(next);
    }
  }, [subTab, fileDirty]);

  /** 返回列表：如有未保存改动则弹确认框 */
  const guardBack = useCallback(() => {
    if (fileDirty) {
      pendingAction.current = "back";
      setShowUnsavedDialog(true);
    } else {
      onBack();
    }
  }, [fileDirty, onBack]);

  /** 确认丢弃并执行挂起的操作 */
  const confirmDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    setFileDirty(false);
    if (pendingAction.current === "tab" && pendingTab !== null) {
      setSubTab(pendingTab);
    } else if (pendingAction.current === "back") {
      onBack();
    }
    pendingAction.current = null;
    setPendingTab(null);
  }, [pendingTab, onBack]);

  /** 取消离开，关闭对话框 */
  const cancelDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    pendingAction.current = null;
    setPendingTab(null);
  }, []);

  // 剥离 frontmatter，只渲染 Markdown 正文
  const bodyMd = useMemo(() => {
    if (content === null) return "";
    const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    if (!normalized.trimStart().startsWith("---")) return normalized;
    const lines = normalized.split("\n");
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") return lines.slice(i + 1).join("\n").trimStart();
    }
    return normalized;
  }, [content]);

  /**
   * 打开依赖图里的一个节点。
   *
   * 两条通路：
   * - `via: "skill"`：技能目录内的文件（相对路径），交给「文件」页签编辑；
   *   扁平技能没有文件页签（只有它自己），保持原地不跳，避免跳进空页签。
   * - `via: "external"`：技能目录外的共享资源，只能按绝对路径只读预览。
   *
   * host 侧 `read` 的允许根在 resolve-refs 成功时已把资源所在目录登记进去
   * （见 src/index.ts 的 `allowedRoots.add(path.dirname(item.path))`），
   * 所以这里直接调 read 不会被「outside scanned workspace roots」拒绝。
   */
  const openNode = useCallback(async (node: DepNode): Promise<void> => {
    if (node.open === undefined) return;
    if (node.open.via === "skill") {
      setSelectedFile(node.id);
      if (!isFlat) setSubTab("files");
      return;
    }
    const target = node.open.path;
    setExternalView({ path: target, content: null, error: null });
    try {
      const res = await api.read(target);
      setExternalView((cur) => (cur !== null && cur.path === target
        ? { path: target, content: res.content, error: null }
        : cur));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExternalView((cur) => (cur !== null && cur.path === target
        ? { path: target, content: null, error: message }
        : cur));
    }
  }, [isFlat]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="row">
        <button onClick={guardBack}>← 返回列表</button>
        <strong>{displayName}</strong>
        <span className="muted">{skill.rel}</span>
        <span style={{ flex: 1 }} />
        {content !== null && (
          <button onClick={() => void copyContent()} style={{ fontSize: 12 }}>
            {copied ? "已复制 ✓" : `复制 ${entryName}`}
          </button>
        )}
      </div>

      <div className="subtabs">
        <button className={subTab === "overview" ? "active" : ""} onClick={() => guardTabSwitch("overview")}>概览</button>
        {!isFlat && (
          <button className={subTab === "files" ? "active" : ""} onClick={() => guardTabSwitch("files")}>文件{files.length > 0 ? ` (${files.length})` : ""}</button>
        )}
        <button className={subTab === "deps" ? "active" : ""} onClick={() => guardTabSwitch("deps")}>
          依赖图
        </button>
      </div>

      {subTab === "overview" && (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {error !== null && <p style={{ color: "#e05555" }}>{entryName} 读取失败：{error}</p>}
          {content === null && error === null && <p className="muted">加载中…</p>}
          {meta && (
            <div>
              <dl className="kv">
                <dt>name</dt><dd>{meta.name || <span className="muted">（缺失）</span>}</dd>
                <dt>description</dt><dd>{meta.description || <span className="muted">（缺失）</span>}</dd>
                {meta.license && <><dt>license</dt><dd>{meta.license}</dd></>}
                {meta.compatibility && <><dt>compatibility</dt><dd><span className="tag">{meta.compatibility}</span></dd></>}
                {meta.allowedTools && meta.allowedTools.length > 0 && (
                  <><dt>allowed-tools</dt><dd>{meta.allowedTools.map((t) => <span key={t} className="tag">{t}</span>)}</dd></>
                )}
                {!isFlat && <><dt>文件数</dt><dd>{filesLoading ? "…" : files.length}</dd></>}
              </dl>

              {constraints.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 13 }}>约束</strong>
                  <div style={{ marginTop: 6 }}>
                    {constraints.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                        <span className="tag" style={{ flexShrink: 0 }}>
                          {c.type === "prohibition" ? "🚫 禁止" : "📌 范围"}
                        </span>
                        <span style={{ flex: 1 }}>{c.text}</span>
                        <span className="muted" style={{ flexShrink: 0, fontSize: 11 }}>L{c.line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="md-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyMd}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "files" && (
        <FileBrowser
          skillDir={skill.dir}
          files={files}
          loading={filesLoading}
          selected={selectedFile}
          onSelect={setSelectedFile}
          onDirtyChange={setFileDirty}
        />
      )}

      {subTab === "deps" && (
        <DepGraphView
          graph={graph}
          onOpenFile={(node) => { void openNode(node); }}
        />
      )}

      {externalView !== null && (
        <ReadOnlyPreview view={externalView} onClose={() => setExternalView(null)} />
      )}

      {showUnsavedDialog && (
        <div className="dialog" onClick={cancelDiscard}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div>有未保存的更改</div>
            <p className="muted">当前文件有未保存的修改，离开将丢失这些更改。</p>
            <div className="actions">
              <button onClick={cancelDiscard}>留下编辑</button>
              <button className="danger" onClick={confirmDiscard}>丢弃更改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyPreview(props: {
  view: { path: string; content: string | null; error: string | null };
  onClose: () => void;
}): React.ReactElement {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const name = props.view.path.replace(/\\/g, "/").split("/").pop() ?? props.view.path;
  return (
    <dialog ref={dialogRef} aria-label={`只读预览：${name}`}
      onCancel={(event) => { event.preventDefault(); props.onClose(); }}
      style={{ width: "min(900px, calc(100vw - 24px))", maxHeight: "calc(100dvh - 32px)",
        padding: 16, border: "1px solid #747980", borderRadius: 8, background: "#24262b", color: "#f1f3f5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ minWidth: 0, overflowWrap: "anywhere", flex: 1 }}>{name}</strong>
        <span className="muted">只读</span>
        <button type="button" aria-label="关闭预览" title="关闭预览" onClick={props.onClose}>×</button>
      </div>
      <div className="muted" style={{ overflowWrap: "anywhere", margin: "8px 0", fontSize: 12 }}>{props.view.path}</div>
      <div style={{ overflow: "auto", maxHeight: "calc(100dvh - 160px)", overflowWrap: "anywhere" }}>
        {props.view.error !== null ? <p role="alert">读取失败：{props.view.error}</p>
          : props.view.content === null ? <p role="status">加载中…</p>
          : /\.mdx?$/i.test(props.view.path)
            ? <div className="md-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{props.view.content}</ReactMarkdown></div>
            : <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{props.view.content}</pre>}
      </div>
    </dialog>
  );
}

function DepGraphView(props: {
  graph: ReturnType<typeof buildDependencyGraph>;
  onOpenFile: (node: DepNode) => void;
}): React.ReactElement {
  const { graph, onOpenFile } = props;
  const { nodes, edges } = graph;
  const rootId = useMemo(() => nodes.find((n) => n.kind === "root")?.id ?? "SKILL.md", [nodes]);
  const { laid, width, height } = useMemo(() => layoutGraph(nodes, edges, rootId), [nodes, edges, rootId]);
  const pos = useMemo(() => new Map(laid.map((n) => [n.id, n])), [laid]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  const clampK = (k: number): number => Math.min(3, Math.max(0.15, k));

  const zoomAt = useCallback((cx: number, cy: number, factor: number): void => {
    setView((v) => {
      const k = clampK(v.k * factor);
      const real = k / v.k;
      return { k, x: cx - (cx - v.x) * real, y: cy - (cy - v.y) * real };
    });
  }, []);

  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 24;
    const k = clampK(Math.min((rect.width - pad * 2) / Math.max(width, 1), (rect.height - pad * 2) / Math.max(height, 1)));
    setView({ k, x: (rect.width - width * k) / 2, y: (rect.height - height * k) / 2 });
  }, [width, height]);

  // 布局变化或容器尺寸变化时自动适应画布
  useEffect(() => {
    fitView();
  }, [fitView]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fitView());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  // 滚轮缩放（非被动监听才能 preventDefault）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: view.x, baseY: view.y, moved: false };
    // 不用 setPointerCapture：捕获会把派生的 click 重定向到容器，节点将收不到点击
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, x: d.baseX + dx, y: d.baseY + dy }));
  };
  const onPointerUp = (): void => {
    // 延迟清除 moved，让节点 onClick（同一交互序列）能读到拖拽标志
    setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };

  if (nodes.length === 0) return <p className="muted">没有可展示的依赖。</p>;

  // 可点性完全由节点自带的 `open` 描述决定：分类节点与没有 open 的节点（URL /
// 环境变量 / 命令）不可点；技能内文件、未引用文件、引用资源，以及扁平技能的
// 入口节点都带 open。
  const clickable = (n: DepNode): boolean => n.open !== undefined;


  const btnStyle: React.CSSProperties = { padding: "2px 8px", fontSize: 12 };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="row" style={{ marginBottom: 6 }}>
        {(["root", "document", "script", "asset", "unref", "external-url", "env-var", "external-command"] as const).map((k) => (
          <span key={k} className="badge" style={{ borderColor: NODE_COLORS[k], color: NODE_COLORS[k] }}>
            {KIND_LABELS[k]}
          </span>
        ))}
        <span className="muted">点击文件节点可打开文件 · 拖拽平移 · 滚轮缩放</span>
        <span style={{ flex: 1 }} />
        <button style={btnStyle} onClick={() => setView((v) => ({ ...v, k: clampK(v.k * 1.2) }))}>＋</button>
        <button style={btnStyle} onClick={() => setView((v) => ({ ...v, k: clampK(v.k / 1.2) }))}>－</button>
        <button style={btnStyle} onClick={fitView}>适应画布</button>
        <button style={btnStyle} onClick={() => setView({ x: 0, y: 0, k: 1 })}>重置</button>
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1, minHeight: 0, position: "relative", overflow: "hidden",
          border: "1px solid rgba(128,128,128,.3)", borderRadius: 8,
          cursor: dragRef.current?.moved ? "grabbing" : "grab",
          background: "radial-gradient(rgba(128,128,128,.12) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width="100%" height="100%">
          <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
            {edges.map((e, i) => {
              const a = pos.get(e.source);
              const b = pos.get(e.target);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
              const x2 = b.x, y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="rgba(128,128,128,0.4)"
                />
              );
            })}
            {laid.map((n) => {
              const canOpen = clickable(n);
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  role={canOpen ? "button" : undefined}
                  tabIndex={canOpen ? 0 : undefined}
                  aria-label={canOpen ? `打开 ${n.label}` : undefined}
                  data-file-node={n.open !== undefined ? n.label : undefined}
                  onKeyDown={(event) => {
                    if (canOpen && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onOpenFile(n);
                    }
                  }}
                  style={canOpen ? { cursor: "pointer" } : undefined}
                  onClick={() => {
                    if (dragRef.current?.moved) return; // 拖拽结束后误落在节点上不触发打开
                    if (canOpen) onOpenFile(n);
                  }}
                >
                  <rect
                    width={NODE_W} height={NODE_H} rx={8}
                    fill="rgba(128,128,128,0.06)"
                    stroke={NODE_COLORS[n.kind]}
                    strokeDasharray={n.kind === "unref" ? "4 3" : undefined}
                  />
                  {n.isGroup && (
                    <rect width={4} height={NODE_H} rx={2} fill={NODE_COLORS[n.kind]} />
                  )}
                  <foreignObject x={n.isGroup ? 12 : 8} y={4} width={NODE_W - 24} height={NODE_H - 8}>
                    <div style={{ height: "100%", display: "flex", alignItems: "center", fontSize: 12,
                      lineHeight: "16px", overflowWrap: "anywhere", overflow: "hidden", pointerEvents: "none" }}>
                      {n.label}
                    </div>
                  </foreignObject>
                  <title>
                    {n.open?.via === "external" ? n.open.path : n.id}{n.line ? ` · L${n.line}` : ""}{canOpen ? " · 点击打开" : ""}
                  </title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
