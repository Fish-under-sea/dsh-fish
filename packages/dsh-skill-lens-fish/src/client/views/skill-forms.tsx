/**
 * 新建/导入技能弹窗。表单状态自管理，成功后经 onCreated(dir) 交回主视图
 * 做重新扫描与详情页跳转。文件解析（.md/.zip）委托 ../zip。
 */
import { useState } from "react";
import { api } from "../api";
import { readImportFile, type ImportFile } from "../zip";

type Location = "project" | "global";

const NAME_HINT = "字母/数字开头，仅含字母数字 . _ -";

/** 从导入文件名推导默认技能名：zip → 文件名（清洗为合法字符），md → 空 */
function defaultNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.(zip|markdown|md)$/i, "");
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-._]+/, "")
    .slice(0, 64);
  return /^[a-zA-Z0-9]/.test(cleaned) ? cleaned : "";
}

function LocationRadios(props: {
  name: string;
  value: Location;
  onChange: (v: Location) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="radio"
          name={props.name}
          checked={props.value === "project"}
          onChange={() => props.onChange("project")}
        />
        当前项目
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="radio"
          name={props.name}
          checked={props.value === "global"}
          onChange={() => props.onChange("global")}
        />
        全局（~/.dsh）
      </label>
    </div>
  );
}

function ErrorLine(props: { error: string }) {
  if (!props.error) return null;
  return <p style={{ color: "#e05555", fontSize: 12, margin: "8px 0 0" }}>{props.error}</p>;
}

/** 字段行标签 */
function FieldLabel(props: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 6, fontSize: 12 }}>{props.children}</div>;
}

/** 新建技能：名称 + 位置 → host 生成模板 SKILL.md */
export function CreateSkillDialog(props: {
  sessionId?: string;
  onClose: () => void;
  onCreated: (dir: string) => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState<Location>("project");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { dir } = await api.createSkill(name.trim(), location, props.sessionId);
      props.onCreated(dir);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="dialog" onClick={() => !busy && props.onClose()}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-title">新建技能</div>
        <div style={{ marginTop: 14 }}>
          <FieldLabel>名称：</FieldLabel>
          <input
            value={name}
            autoFocus
            placeholder="my-skill"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{NAME_HINT}</div>
        </div>
        <div style={{ marginTop: 14 }}>
          <FieldLabel>位置：</FieldLabel>
          <LocationRadios name="skill-create-loc" value={location} onChange={setLocation} />
        </div>
        <ErrorLine error={error} />
        <div className="actions">
          <button onClick={props.onClose} disabled={busy}>取消</button>
          <button className="primary" onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? "创建中…" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 导入技能：文件区（首行）→ 名称（默认取 zip 文件名）→ 位置（末行） */
export function ImportSkillDialog(props: {
  sessionId?: string;
  onClose: () => void;
  onCreated: (dir: string) => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState<Location>("project");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickFile = (f: File | null) => {
    setError("");
    if (!f) {
      setFile(null);
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".md") && !lower.endsWith(".markdown") && !lower.endsWith(".zip")) {
      setFile(null);
      setError("仅支持 .md 或 .zip 文件");
      return;
    }
    setFile(f);
    // 名称默认值：zip → 文件名清洗；md → 空（由用户填写）
    setName(defaultNameFromFile(f.name));
  };

  const submit = async () => {
    if (!name.trim() || !file || busy) return;
    setBusy(true);
    setError("");
    try {
      const files: ImportFile[] = await readImportFile(file);
      const { dir } = await api.importSkill(name.trim(), location, files, props.sessionId);
      props.onCreated(dir);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="dialog" onClick={() => !busy && props.onClose()}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-title">导入技能</div>

        {/* 首行：文件选择区（点击/拖放） */}
        <label className="file-zone" style={{ marginTop: 14 }}>
          <input
            type="file"
            accept=".md,.markdown,.zip"
            style={{ display: "none" }}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file
            ? `✓ ${file.name}（${(file.size / 1024).toFixed(1)} KB）— 点击更换`
            : "点击选择或拖入 .md / .zip 文件"}
        </label>

        <div style={{ marginTop: 14 }}>
          <FieldLabel>名称：</FieldLabel>
          <input
            value={name}
            placeholder={file && file.name.toLowerCase().endsWith(".md") ? "填写技能名称" : "imported-skill"}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{NAME_HINT}</div>
        </div>

        {/* 末行：位置 */}
        <div style={{ marginTop: 14 }}>
          <FieldLabel>位置：</FieldLabel>
          <LocationRadios name="skill-import-loc" value={location} onChange={setLocation} />
        </div>

        <ErrorLine error={error} />
        <div className="actions">
          <button onClick={props.onClose} disabled={busy}>取消</button>
          <button className="primary" onClick={() => void submit()} disabled={busy || !name.trim() || !file}>
            {busy ? "导入中…" : "导入"}
          </button>
        </div>
      </div>
    </div>
  );
}
