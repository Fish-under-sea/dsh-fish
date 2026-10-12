import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { SkillMeta } from "../api";
import type { ClientContext } from "../contracts";
import { SkillDetail } from "./skill-detail";
import { CreateSkillDialog, ImportSkillDialog } from "./skill-forms";

/**
 * Skill Lens 主视图：注册进 DSH conversation.view 槽位。
 * 扫描入口 + 技能清单（筛选/删除）+ 技能详情子路由。
 * 数据全部来自插件 host 半的 /skill-lens/api。
 */

const STYLE_ID = "skill-lens-styles";

const CSS = `
.skill-lens { font-size: 13px; color: inherit; padding: 12px; height: 100%; overflow: auto; box-sizing: border-box; display: flex; flex-direction: column; }
.skill-lens .fb { display: flex; align-items: stretch; gap: 8px; min-height: 0; }
.skill-lens .fb .tree { width: 260px; flex-shrink: 0; border: 1px solid rgba(128,128,128,.3); border-radius: 8px; padding: 6px; overflow: auto; box-sizing: border-box; }
.skill-lens .fb .preview { flex: 1; min-width: 0; border: 1px solid rgba(128,128,128,.3); border-radius: 8px; padding: 10px; overflow: auto; box-sizing: border-box; }
.skill-lens .fb pre { margin: 0; background: transparent; padding: 0; max-height: none; }
.skill-lens .float-bar { position: absolute; right: 16px; bottom: 16px; z-index: 5; display: flex; gap: 8px; padding: 8px; border-radius: 8px; border: 1px solid rgba(128,128,128,.35); background: rgba(30,30,30,.92); }
.skill-lens[data-theme="light"] .float-bar { background: rgba(255,255,255,.95); }
.skill-lens[data-theme="light"] .dialog .box { background: #fff; color: #222; }
.skill-lens .seg { display: inline-flex; border: 1px solid rgba(128,128,128,.35); border-radius: 6px; overflow: hidden; }
.skill-lens .seg button { border: none; border-radius: 0; padding: 2px 10px; }
.skill-lens .seg button.active { background: rgba(128,128,128,.2); }
.skill-lens textarea.editor { width: 100%; height: 100%; box-sizing: border-box; background: transparent; color: inherit; border: none; outline: none; resize: none; font-family: monospace; font-size: 12px; line-height: 1.6; }
.skill-lens .editor-wrap { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.skill-lens .line-numbers { padding: 4px 8px 4px 4px; text-align: right; color: rgba(128,128,128,.45); font-family: monospace; font-size: 12px; line-height: 1.6; user-select: none; overflow: hidden; min-width: 32px; flex-shrink: 0; }
.skill-lens .editor-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.skill-lens .split-pane { flex: 1; display: flex; min-height: 0; gap: 1px; overflow: hidden; }
.skill-lens .split-pane > div { flex: 1; min-width: 0; overflow: auto; border: 1px solid rgba(128,128,128,.2); border-radius: 6px; padding: 10px; }
.skill-lens pre { margin: 0; }
.skill-lens .md-body { margin-top: 12px; line-height: 1.65; }
.skill-lens .md-body h1, .skill-lens .md-body h2, .skill-lens .md-body h3, .skill-lens .md-body h4 { margin: 14px 0 6px; line-height: 1.35; }
.skill-lens .md-body h1 { font-size: 18px; } .skill-lens .md-body h2 { font-size: 16px; }
.skill-lens .md-body h3 { font-size: 14px; } .skill-lens .md-body h4 { font-size: 13px; }
.skill-lens .md-body p { margin: 6px 0; }
.skill-lens .md-body ul, .skill-lens .md-body ol { margin: 6px 0; padding-left: 22px; }
.skill-lens .md-body li { margin: 2px 0; }
.skill-lens .md-body code { background: rgba(128,128,128,.15); border-radius: 4px; padding: 1px 5px; font-family: monospace; font-size: 12px; }
.skill-lens .md-body pre { background: rgba(128,128,128,.1); border-radius: 6px; padding: 10px; overflow: auto; }
.skill-lens .md-body pre code { background: transparent; padding: 0; }
.skill-lens .md-body blockquote { margin: 6px 0; padding: 2px 12px; border-left: 3px solid rgba(128,128,128,.4); opacity: .85; }
.skill-lens .md-body table { border-collapse: collapse; margin: 8px 0; }
.skill-lens .md-body th, .skill-lens .md-body td { border: 1px solid rgba(128,128,128,.35); padding: 4px 8px; }
.skill-lens .md-body hr { border: none; border-top: 1px solid rgba(128,128,128,.3); }
.skill-lens .md-body a { color: #5b8def; }
.skill-lens button { cursor: pointer; border: 1px solid rgba(128,128,128,.4); background: transparent; color: inherit; border-radius: 6px; padding: 4px 10px; font-size: 12px; }
.skill-lens button.primary { background: #4f7cff; border-color: #4f7cff; color: #fff; }
.skill-lens button.danger:hover { border-color: #e05555; color: #e05555; }
.skill-lens button:disabled { opacity: .5; cursor: default; }
.skill-lens input { background: transparent; border: 1px solid rgba(128,128,128,.4); color: inherit; border-radius: 6px; padding: 4px 8px; font-size: 12px; }
.skill-lens .row { display: flex; align-items: center; gap: 8px; }
.skill-lens .list { border: 1px solid rgba(128,128,128,.3); border-radius: 8px; overflow: hidden; margin-top: 8px; }
.skill-lens .item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid rgba(128,128,128,.15); cursor: pointer; }
.skill-lens .item:last-child { border-bottom: none; }
.skill-lens .item:hover { background: rgba(128,128,128,0.08); }
.skill-lens .muted { opacity: 0.55; font-size: 12px; }
.skill-lens .kv { display: grid; grid-template-columns: 110px 1fr; gap: 4px 12px; margin-top: 8px; }
.skill-lens .kv dt { opacity: 0.55; } .skill-lens .kv dd { margin: 0; }
.skill-lens .subtabs { display: flex; gap: 4px; margin: 10px 0 8px; }
.skill-lens .subtabs button.active { background: rgba(128,128,128,0.15); }
.skill-lens pre { background: rgba(128,128,128,0.08); border-radius: 6px; padding: 10px; overflow: auto; max-height: 420px; font-size: 12px; }
.skill-lens .tree { font-family: monospace; font-size: 12px; }
.skill-lens .tree div { cursor: pointer; padding: 1px 4px; border-radius: 4px; }
.skill-lens .tree div:hover { background: rgba(128,128,128,0.1); }
.skill-lens svg text { font-size: 11px; fill: currentColor; }
.skill-lens .badge { font-size: 10px; border: 1px solid rgba(128,128,128,.5); border-radius: 999px; padding: 0 6px; opacity: 0.8; }
.skill-lens .badge.missing { border-color: #e05555; color: #e05555; opacity: 1; }
.skill-lens .tag { display:inline-block; font-size:11px; background:rgba(128,128,128,.12); border-radius:4px; padding:1px 6px; margin:2px 4px 2px 0; }
.skill-lens .tag-p { background:rgba(79,124,255,.16); color:#8fb0ff; }
.skill-lens .tag-g { background:rgba(52,199,123,.16); color:#6fd6a2; }
.skill-lens[data-theme="light"] .tag-p { background:rgba(79,124,255,.12); color:#2b5fd9; }
.skill-lens[data-theme="light"] .tag-g { background:rgba(52,199,123,.14); color:#17864f; }
.skill-lens .dialog { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 10; }
.skill-lens .dialog .box { background: var(--sl-bg, #1e1e1e); color: #e6e6e6; border: 1px solid rgba(128,128,128,.4); border-radius: 10px; padding: 20px; width: 440px; max-width: calc(100vw - 32px); }
.skill-lens .dialog .box .dlg-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.skill-lens .dialog .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.skill-lens .file-zone { display: flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px dashed rgba(128,128,128,.5); border-radius: 8px; padding: 14px 12px; cursor: pointer; font-size: 12px; color: inherit; text-align: center; min-height: 48px; box-sizing: border-box; user-select: none; }
.skill-lens .file-zone:hover { border-color: #4f7cff; color: #4f7cff; }
.skill-lens .cb { width: 16px; height: 16px; accent-color: #4f7cff; cursor: pointer; flex-shrink: 0; }
.skill-lens .batch-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(79,124,255,.1); border: 1px solid rgba(79,124,255,.3); border-radius: 8px; margin-top: 8px; }
.skill-lens .batch-bar .muted { flex: 1; }
`;

/** 跟随宿主主题：DSH 通过 html 的 color-scheme 切换深浅色 */
function useHostTheme(): "light" | "dark" {
  const detect = (): "light" | "dark" =>
    typeof document !== "undefined" && getComputedStyle(document.documentElement).colorScheme === "light"
      ? "light"
      : "dark";
  const [theme, setTheme] = useState<"light" | "dark">(detect);
  useEffect(() => {
    const el = document.documentElement;
    const update = (): void => setTheme(detect());
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export interface SkillEntry {
  dir: string;
  root: string;
  rel: string;
  /** "dir" = 目录式技能；"file" = 扁平技能（dir 即技能文件本身） */
  kind: "dir" | "file";
}

/** 技能列表展示名：扁平技能的 rel 带 .md 后缀，展示时去掉 */
function displayNameOf(skill: SkillEntry): string {
  const last = skill.rel.split("/").pop() ?? skill.rel;
  return skill.kind === "file" ? last.replace(/\.md$/i, "") : last;
}

type Phase =
  | { kind: "idle" }
  | { kind: "scanning"; found: number; scanned: number }
  | { kind: "done"; roots: string[]; globalRoot?: string; skills: SkillEntry[] }
  | { kind: "error"; message: string };

/**
 * 根路径展示徽标：以 host 判定的全局根为准。
 * 全局根不再是固定的 `~/.dsh`（自定义 DSH_HOME 时形如 `~/.dsh-beta/skills`），
 * 靠路径末段猜会误判，因此直接比对 host 返回的 globalRoot。
 */
function rootBadge(root: string, globalRoot?: string): { label: string; cls: string } {
  const norm = (value: string): string => value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const isGlobal = globalRoot !== undefined && globalRoot !== "" && norm(root) === norm(globalRoot);
  return isGlobal ? { label: "全局", cls: "tag-g" } : { label: "项目", cls: "tag-p" };
}

export function SkillLensApp(props: { sessionId?: string }): React.ReactElement {
  ensureStyles();
  const theme = useHostTheme();
  const sessionId = props.sessionId;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<SkillEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SkillEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailDirty, setDetailDirty] = useState(false);
  const [showUnsavedBackDialog, setShowUnsavedBackDialog] = useState(false);
  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [metaMap, setMetaMap] = useState<Map<string, SkillMeta>>(new Map());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  /** 执行扫描并返回结果（供新建/导入后定位新技能跳详情页用） */
  const runScan = useCallback(async () => {
    setPhase({ kind: "scanning", found: 0, scanned: 0 });
    try {
      const res = await api.scanStream(sessionId, (scanned, found) => {
        setPhase({ kind: "scanning", found, scanned });
      });
      setPhase({ kind: "done", roots: res.roots, globalRoot: res.globalRoot, skills: res.skills });
      // 异步获取元数据（不阻塞列表展示）
      api.skillMeta(res.skills.map((s) => s.dir)).then(({ results }) => {
        setMetaMap(new Map(results.map((r) => [r.dir, r])));
      }).catch(() => {});
      return res;
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
      return null;
    }
  }, [sessionId]);

  const startScan = useCallback(async () => {
    await runScan();
  }, [runScan]);

  /** 新建/导入成功：重新扫描并跳转到新技能详情页 */
  const handleCreated = useCallback(async (dir: string) => {
    setShowCreateDialog(false);
    setShowImportDialog(false);
    const res = await runScan();
    const entry = res?.skills.find((s) => s.dir === dir);
    if (entry) setSelected(entry);
  }, [runScan]);

  useEffect(() => {
    void startScan();
  }, [startScan]);

  const filtered = useMemo(() => {
    const skills = phase.kind === "done" ? phase.skills : [];
    const q = filter.trim().toLowerCase();
    if (q === "") return skills;
    return skills.filter((s) => {
      if (s.rel.toLowerCase().includes(q)) return true;
      const meta = metaMap.get(s.dir);
      return meta?.description?.toLowerCase().includes(q) ?? false;
    });
  }, [phase, filter, metaMap]);

  const globalRoot = phase.kind === "done" ? phase.globalRoot : undefined;

  const doDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(confirmDelete.dir);
      setConfirmDelete(null);
      setSelected(null);
      await startScan();
    } catch (err) {
      alert(`删除失败：${(err as Error).message}`);
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, startScan]);

  /** 从详情返回列表：如详情有未保存改动则拦截 */
  const guardDetailBack = useCallback(() => {
    if (detailDirty) {
      setShowUnsavedBackDialog(true);
    } else {
      setSelected(null);
    }
  }, [detailDirty]);

  const confirmDetailBack = useCallback(() => {
    setShowUnsavedBackDialog(false);
    setDetailDirty(false);
    setSelected(null);
  }, []);

  /** 全选/取消全选当前筛选结果 */
  const toggleSelectAll = useCallback(() => {
    const allDirs = filtered.map((s) => s.dir);
    const allSelected = allDirs.length > 0 && allDirs.every((d) => selectedDirs.has(d));
    if (allSelected) {
      setSelectedDirs(new Set());
    } else {
      setSelectedDirs(new Set(allDirs));
    }
  }, [filtered, selectedDirs]);

  /** 切换单个技能的选中状态 */
  const toggleSelect = useCallback((dir: string) => {
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }, []);

  /** 批量删除 */
  const doBatchDelete = useCallback(async () => {
    setBatchDeleting(true);
    try {
      const dirs = [...selectedDirs];
      const res = await api.batchDelete(dirs);
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length > 0) {
        alert(`部分删除失败：\n${failed.map((f) => `${f.dir}: ${f.error}`).join("\n")}`);
      }
      setSelectedDirs(new Set());
      setConfirmBatchDelete(false);
      await startScan();
    } catch (err) {
      alert(`批量删除失败：${(err as Error).message}`);
    } finally {
      setBatchDeleting(false);
    }
  }, [selectedDirs, startScan]);

  /** 批量导出 ZIP */
  const doBatchExport = useCallback(async () => {
    setExporting(true);
    try {
      await api.batchExport([...selectedDirs], "skills.zip");
    } catch (err) {
      alert(`导出失败：${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }, [selectedDirs]);

  // 详情为整页视图：选中技能后列表整体让位，返回时回到列表
  if (selected) {
    return (
      <div className="skill-lens" data-theme={theme}>
        <SkillDetail skill={selected} onBack={guardDetailBack} onDirtyChange={setDetailDirty} />
        {showUnsavedBackDialog && (
          <div className="dialog" onClick={() => setShowUnsavedBackDialog(false)}>
            <div className="box" onClick={(e) => e.stopPropagation()}>
              <div>有未保存的更改</div>
              <p className="muted">当前文件有未保存的修改，返回列表将丢失这些更改。</p>
              <div className="actions">
                <button onClick={() => setShowUnsavedBackDialog(false)}>留下编辑</button>
                <button className="danger" onClick={confirmDetailBack}>丢弃更改</button>
              </div>
            </div>
          </div>
        )}
        {confirmDelete && (
          <div className="dialog" onClick={() => !deleting && setConfirmDelete(null)}>
            <div className="box" onClick={(e) => e.stopPropagation()}>
              <div>确认删除技能目录？</div>
              <p className="muted" style={{ wordBreak: "break-all" }}>{confirmDelete.rel}</p>
              <p className="muted">将永久删除该目录及其全部文件（不可恢复；如被 Git 跟踪可从 VCS 恢复）。</p>
              <div className="actions">
                <button onClick={() => setConfirmDelete(null)} disabled={deleting}>取消</button>
                <button className="primary" onClick={() => void doDelete()} disabled={deleting}>
                  {deleting ? "删除中…" : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="skill-lens" data-theme={theme}>
      <div className="row">
        <button className="primary" onClick={() => void startScan()}>重新扫描</button>
        <input
          placeholder="筛选技能目录…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        {phase.kind === "done" && (
          <span className="muted">{phase.skills.length} 个技能 · 扫描位置 {phase.roots.length} 个</span>
        )}
        <button onClick={() => setShowCreateDialog(true)}>＋ 新建</button>
        <button onClick={() => setShowImportDialog(true)}>导入</button>
      </div>
      {phase.kind === "done" && (
        <div className="row" style={{ marginTop: 4 }}>
          {phase.roots.map((r) => {
            const badge = rootBadge(r);
            return (
              <span key={r} className={`tag ${badge.cls}`} title={r}>{badge.label}：{r}</span>
            );
          })}
        </div>
      )}

      {phase.kind === "scanning" && <p className="muted">正在扫描… 已扫描 {phase.scanned} 个目录，发现 {phase.found} 个技能</p>}
      {phase.kind === "error" && <p style={{ color: "#e05555" }}>扫描失败：{phase.message}</p>}
      {phase.kind === "idle" && <p className="muted">点击"重新扫描"开始。</p>}

      {filtered.length > 0 && (
        <div className="list">
          <div className="item" style={{ cursor: "default", background: "rgba(128,128,128,0.04)" }}>
            <input
              type="checkbox"
              className="cb"
              checked={filtered.length > 0 && filtered.every((s) => selectedDirs.has(s.dir))}
              onChange={toggleSelectAll}
            />
            <span className="muted" style={{ flex: 1 }}>全选</span>
            {selectedDirs.size > 0 && <span className="muted">{selectedDirs.size} 项已选</span>}
          </div>
          {filtered.map((skill) => (
            <div key={skill.dir} className="item" onClick={() => setSelected(skill)}>
              <input
                type="checkbox"
                className="cb"
                checked={selectedDirs.has(skill.dir)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleSelect(skill.dir)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span className={`tag ${rootBadge(skill.root, globalRoot).cls}`}>{rootBadge(skill.root, globalRoot).label}</span>
                    {displayNameOf(skill)}
                  </span>
                  <span className="muted" style={{ fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {skill.rel}
                    {metaMap.get(skill.dir)?.birthtime && <> · {new Date(metaMap.get(skill.dir)!.birthtime!).toLocaleDateString()}</>}
                  </span>
                </div>
                {metaMap.get(skill.dir)?.description && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {metaMap.get(skill.dir)!.description}
                  </div>
                )}
              </div>
              <button
                className="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(skill);
                }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedDirs.size > 0 && (
        <div className="batch-bar">
          <span className="muted">已选 {selectedDirs.size} 项</span>
          <button onClick={() => void doBatchExport()} disabled={exporting}>
            {exporting ? "导出中…" : "导出 ZIP"}
          </button>
          <button className="danger" onClick={() => setConfirmBatchDelete(true)}>
            批量删除
          </button>
        </div>
      )}
      {phase.kind === "done" && filtered.length === 0 && (
        <p className="muted">{filter ? "没有匹配的技能。" : "未发现技能。请确认项目 .dsh/skills 或全局技能根（$DSH_HOME/skills）下存在 SKILL.md 或 <名称>.md 后重新扫描。"}</p>
      )}

      {confirmDelete && (
        <div className="dialog" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div>{confirmDelete.kind === "file" ? "确认删除技能文件？" : "确认删除技能目录？"}</div>
            <p className="muted" style={{ wordBreak: "break-all" }}>{confirmDelete.rel}</p>
            <p className="muted">
              {confirmDelete.kind === "file"
                ? "将永久删除该技能文件（不可恢复；如被 Git 跟踪可从 VCS 恢复）。"
                : "将永久删除该目录及其全部文件（不可恢复；如被 Git 跟踪可从 VCS 恢复）。"}
            </p>
            <div className="actions">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}>取消</button>
              <button className="primary" onClick={() => void doDelete()} disabled={deleting}>
                {deleting ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBatchDelete && (
        <div className="dialog" onClick={() => !batchDeleting && setConfirmBatchDelete(false)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div>确认批量删除？</div>
            <p className="muted">将永久删除 {selectedDirs.size} 个技能目录及其全部文件（不可恢复）。</p>
            <div className="actions">
              <button onClick={() => setConfirmBatchDelete(false)} disabled={batchDeleting}>取消</button>
              <button className="primary" onClick={() => void doBatchDelete()} disabled={batchDeleting}>
                {batchDeleting ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateDialog && (
        <CreateSkillDialog
          sessionId={sessionId}
          onClose={() => setShowCreateDialog(false)}
          onCreated={(dir) => void handleCreated(dir)}
        />
      )}
      {showImportDialog && (
        <ImportSkillDialog
          sessionId={sessionId}
          onClose={() => setShowImportDialog(false)}
          onCreated={(dir) => void handleCreated(dir)}
        />
      )}
    </div>
  );
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject("conversation.view", () =>
    ctx.slots.register(
      { name: "conversation.view", id: "skill-lens", order: 50, label: "Skill Lens" },
      SkillLensApp,
    ),
  );
}
