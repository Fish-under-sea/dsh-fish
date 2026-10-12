import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api";

/** 由 posix 相对路径列表构建目录树 */
interface TreeNode {
  name: string;
  /** 目录节点 children 非空；文件节点为 null */
  children: TreeNode[] | null;
  /** 节点的完整相对路径（文件与目录都有） */
  path: string;
}

function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode = { name: "", children: [], path: "" };
  const dirMaps = new Map<TreeNode, Map<string, TreeNode>>();
  const mapOf = (node: TreeNode): Map<string, TreeNode> => {
    let m = dirMaps.get(node);
    if (!m) {
      m = new Map();
      dirMaps.set(node, m);
    }
    return m;
  };
  for (const file of files) {
    const segs = file.split("/");
    let cur = root;
    for (let i = 0; i < segs.length; i++) {
      const name = segs[i];
      const isLeaf = i === segs.length - 1;
      const m = mapOf(cur);
      let next = m.get(name);
      if (!next) {
        const parentPath = cur === root ? "" : cur.path;
        const fullPath = parentPath === "" ? name : `${parentPath}/${name}`;
        next = isLeaf
          ? { name, children: null, path: file }
          : { name, children: [], path: fullPath };
        m.set(name, next);
      }
      cur = next;
    }
  }
  const materialize = (node: TreeNode): TreeNode => {
    const m = dirMaps.get(node);
    if (!m) return node;
    node.children = [...m.values()].map(materialize).sort((a, b) => {
      const aDir = a.children !== null, bDir = b.children !== null;
      if (aDir !== bDir) return aDir ? -1 : 1; // 目录在前
      return a.name.localeCompare(b.name);
    });
    return node;
  };
  return [...mapOf(root).values()].map(materialize);
}

type ViewMode = "preview" | "edit" | "split";

/** 技能目录文件浏览：左侧目录树（可折叠），右侧编辑/预览。选中状态由父组件托管（依赖图点击跳转复用）。 */
export function FileBrowser(props: {
  skillDir: string;
  files: string[];
  loading: boolean;
  selected: string | null;
  onSelect: (rel: string | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
}): React.ReactElement {
  const { files, loading, selected, onSelect } = props;
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ViewMode>("preview");
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [showFileSwitchDialog, setShowFileSwitchDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumRef = useRef<HTMLDivElement | null>(null);

  // 行号数量
  const lineCount = useMemo(() => (draft.split("\n").length), [draft]);

  // 编辑器滚动时同步行号
  const onEditorScroll = useCallback((): void => {
    const ta = textareaRef.current;
    const ln = lineNumRef.current;
    if (ta && ln) ln.scrollTop = ta.scrollTop;
  }, []);

  // Tab 键插入 2 空格而非切换焦点
  const onEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      setDraft(newValue);
      // 恢复光标位置（需在下一帧设置）
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, []);

  const tree = useMemo(() => buildTree(files), [files]);
  const isMarkdown = selected !== null && /\.mdx?$/i.test(selected);

  // 文件区高度显式钉在"视口底部 - 智能体输入框区域"，与宿主容器的高度行为解耦
  const fbRef = useRef<HTMLDivElement | null>(null);
  const [fbHeight, setFbHeight] = useState<number | undefined>(undefined);
  const measure = useCallback((): void => {
    const el = fbRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const FOOTER_GAP = 136; // 输入框高度 + 底部留白（与对话框上边缘保留间隙）
    setFbHeight(Math.max(320, window.innerHeight - top - FOOTER_GAP));
  }, []);
  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, loading, files.length, selected]);

  useEffect(() => {
    if (selected === null) {
      setContent(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setSaveError(null);
    setContent(null);
    setMode("preview");
    void (async () => {
      try {
        const res = await api.read(`${props.skillDir}/${selected}`);
        if (!cancelled) setContent(res.content);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.skillDir, selected]);

  // 进入编辑/分屏模式时以当前内容为草稿基线
  useEffect(() => {
    if ((mode === "edit" || mode === "split") && content !== null) setDraft(content);
  }, [mode, content]);

  const dirty = (mode === "edit" || mode === "split") && content !== null && draft !== content;

  // 将 dirty 状态同步给父组件，用于切页签/返回前拦截
  useEffect(() => {
    props.onDirtyChange?.(dirty);
  }, [dirty, props.onDirtyChange]);

  const save = async (): Promise<void> => {
    if (selected === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.write(`${props.skillDir}/${selected}`, draft);
      setContent(draft);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const discard = (): void => {
    setDraft(content ?? "");
  };

  /** 文件树点击文件：如有未保存改动则弹确认框 */
  const guardFileSelect = (path: string): void => {
    if (dirty) {
      setPendingFile(path);
      setShowFileSwitchDialog(true);
    } else {
      onSelect(path);
    }
  };

  const confirmFileSwitch = (): void => {
    setShowFileSwitchDialog(false);
    // 退出编辑模式以重置 dirty 状态
    setMode("preview");
    onSelect(pendingFile);
    setPendingFile(null);
  };

  const cancelFileSwitch = (): void => {
    setShowFileSwitchDialog(false);
    setPendingFile(null);
  };

  const toggleDir = (path: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactElement => {
    const isDir = node.children !== null;
    const isCollapsed = isDir && collapsed.has(node.path);
    return (
      <div key={isDir ? `dir:${node.path}` : `file:${node.path}`}>
        <div
          style={{
            paddingLeft: 4 + depth * 14,
            background: !isDir && node.path === selected ? "rgba(128,128,128,0.15)" : undefined,
            opacity: isDir ? 0.85 : 1,
          }}
          onClick={() => (isDir ? toggleDir(node.path) : guardFileSelect(node.path))}
        >
          {isDir ? (isCollapsed ? "▸ " : "▾ ") : ""}
          {node.name}
          {isDir ? "/" : ""}
        </div>
        {isDir && !isCollapsed && node.children!.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (loading) return <p className="muted">目录加载中…</p>;
  if (files.length === 0) return <p className="muted">目录为空。</p>;

  return (
    <div className="fb" ref={fbRef} style={{ height: fbHeight, position: "relative" }}>
      <div className="tree">
        {tree.map((node) => renderNode(node, 0))}
      </div>
      <div className="preview" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
        {selected !== null && error === null && (
          <div className="row" style={{ marginBottom: 8, flexShrink: 0 }}>
            <div className="seg">
              <button
                className={mode === "preview" ? "active" : ""}
                onClick={() => setMode("preview")}
                disabled={mode === "preview"}
              >
                预览
              </button>
              <button
                className={mode === "edit" ? "active" : ""}
                onClick={() => setMode("edit")}
                disabled={mode === "edit"}
              >
                编辑
              </button>
              {isMarkdown && (
                <button
                  className={mode === "split" ? "active" : ""}
                  onClick={() => setMode("split")}
                  disabled={mode === "split"}
                >
                  分屏
                </button>
              )}
            </div>
            <strong style={{ flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected}
            </strong>
          </div>
        )}
        {saveError !== null && <p style={{ color: "#e05555", margin: "0 0 8px" }}>保存失败：{saveError}</p>}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {error !== null && <p style={{ color: "#e05555", margin: 0 }}>读取失败：{error}</p>}
          {content === null && error === null && selected !== null && <p className="muted" style={{ margin: 0 }}>加载中…</p>}
          {selected === null && <p className="muted" style={{ margin: 0 }}>点击左侧文件查看内容。</p>}
          {content !== null && mode === "preview" && isMarkdown && (
            <div className="md-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
          {content !== null && mode === "preview" && !isMarkdown && <pre>{content}</pre>}
          {content !== null && mode === "edit" && (
            <div className="editor-wrap">
              <div className="line-numbers" ref={lineNumRef}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className="editor-pane">
                <textarea
                  ref={textareaRef}
                  className="editor"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onScroll={onEditorScroll}
                  onKeyDown={onEditorKeyDown}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
          {content !== null && mode === "split" && isMarkdown && (
            <div className="split-pane">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="editor-wrap" style={{ flex: 1 }}>
                  <div className="line-numbers" ref={lineNumRef}>
                    {Array.from({ length: lineCount }, (_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <div className="editor-pane">
                    <textarea
                      ref={textareaRef}
                      className="editor"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onScroll={onEditorScroll}
                      onKeyDown={onEditorKeyDown}
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>
              <div className="md-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
              </div>
            </div>
          )}
        {dirty && (
          <div
            className="float-bar"
          >
            <button onClick={discard} disabled={saving}>取消</button>
            <button className="primary" onClick={() => void save()} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        )}
        </div>
      </div>

      {showFileSwitchDialog && (
        <div className="dialog" onClick={cancelFileSwitch}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div>有未保存的更改</div>
            <p className="muted">切换文件将丢失当前未保存的修改。</p>
            <div className="actions">
              <button onClick={cancelFileSwitch}>留下编辑</button>
              <button className="danger" onClick={confirmFileSwitch}>丢弃更改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
